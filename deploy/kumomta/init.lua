--[[
  Postly's KumoMTA policy (ADR-020). The same file runs in development
  (infra/docker-compose.yml, everything delivered to Mailpit) and production
  (docker-compose.yml). Behaviour differs only through environment variables:

    INTERNAL_TOKEN         shared with the API; required
    POSTLY_API_URL         where /internal/* is served (default http://127.0.0.1:3000)
    KUMO_HOSTNAME          EHLO and listener hostname; matches the sending IPs' PTR in production
    KUMO_INJECT_LISTEN     injection listener, private network only (default 127.0.0.1:2525)
    KUMO_INJECT_RELAY_HOSTS comma-separated hosts/CIDRs allowed to inject (default 127.0.0.1)
    KUMO_HTTP_LISTEN       admin API, metrics and liveness (default 127.0.0.1:8000)
    KUMO_SMART_HOST        development only: deliver every message to this host:port
    KUMO_TSA_URL           traffic-shaping automation daemon; unset disables automation

  Postly owns the customer-facing logic; this file only signs, shapes,
  delivers and reports back.
]]
local kumo = require 'kumo'
local shaping = require 'policy-extras.shaping'
local log_hooks = require 'policy-extras.log_hooks'

local API = os.getenv 'POSTLY_API_URL' or 'http://127.0.0.1:3000'
local TOKEN = os.getenv 'INTERNAL_TOKEN' or error 'INTERNAL_TOKEN must be set'
local HOSTNAME = os.getenv 'KUMO_HOSTNAME' or 'mta.postly.invalid'
local INJECT_LISTEN = os.getenv 'KUMO_INJECT_LISTEN' or '127.0.0.1:2525'
local HTTP_LISTEN = os.getenv 'KUMO_HTTP_LISTEN' or '127.0.0.1:8000'
local SMART_HOST = os.getenv 'KUMO_SMART_HOST'
local TSA_URL = os.getenv 'KUMO_TSA_URL'
local POLICY_DIR = '/opt/kumomta/etc/policy'

local function split(value)
  local parts = {}
  for part in string.gmatch(value, '[^,%s]+') do
    table.insert(parts, part)
  end
  return parts
end
local INJECT_RELAY_HOSTS = split(os.getenv 'KUMO_INJECT_RELAY_HOSTS' or '127.0.0.1')

-- Delivery outcomes go back to Postly's API. KumoMTA's stock JSON hook
-- rejects with 500 on any failure, which drops the record for good; this one
-- rejects with 4xx so the record stays queued and is retried.
log_hooks:new {
  name = 'postly',
  log_parameters = {
    meta = { 'x_postly_message_id', 'tenant' },
  },
  queue_config = {
    retry_interval = '30s',
    max_retry_interval = '10m',
    max_age = '3 days',
  },
  constructor = function(domain, tenant, campaign)
    local connection = {}
    local client = kumo.http.build_client {}
    function connection:send(message)
      local response = client
        :post(API .. '/internal/kumo/events')
        :header('Content-Type', 'application/json')
        :header('Authorization', 'Bearer ' .. TOKEN)
        :body(message:get_data())
        :send()
      local disposition = string.format('%d %s', response:status_code(), response:status_reason())
      if response:status_is_success() then
        return disposition
      end
      kumo.reject(400, disposition)
    end
    function connection:close()
      client:close()
    end
    return connection
  end,
}

local shaper
if TSA_URL then
  shaper = shaping:setup_with_automation {
    publish = { TSA_URL },
    subscribe = { TSA_URL },
    extra_files = { POLICY_DIR .. '/shaping.toml' },
  }
else
  shaper = shaping:setup_with_automation {
    publish = {},
    subscribe = {},
    extra_files = { POLICY_DIR .. '/shaping.toml' },
  }
end

kumo.on('init', function()
  kumo.define_spool { name = 'data', path = '/var/spool/kumomta/data', kind = 'RocksDB' }
  kumo.define_spool { name = 'meta', path = '/var/spool/kumomta/meta', kind = 'RocksDB' }

  kumo.configure_local_logs {
    log_dir = '/var/log/kumomta',
    max_segment_duration = '1m',
    meta = { 'x_postly_message_id', 'tenant' },
  }

  kumo.configure_bounce_classifier {
    files = { '/opt/kumomta/share/bounce_classifier/iana.toml' },
  }

  -- Public: receives asynchronous bounces and feedback reports for customers'
  -- return-path domains. Nothing external may relay through it. (An empty Lua
  -- table would serialise as a map, which KumoMTA rejects, so localhost is
  -- named explicitly.)
  kumo.start_esmtp_listener {
    listen = '0.0.0.0:25',
    hostname = HOSTNAME,
    relay_hosts = { '127.0.0.1' },
  }

  -- Private: the send workers inject here.
  kumo.start_esmtp_listener {
    listen = INJECT_LISTEN,
    hostname = HOSTNAME,
    relay_hosts = INJECT_RELAY_HOSTS,
    -- Attachments are capped at 10 MB by the API; leave room for encoding.
    max_message_size = 30 * 1024 * 1024,
  }

  -- Admin API, metrics and liveness. The trusted hosts are the private network.
  kumo.start_http_listener {
    listen = HTTP_LISTEN,
    trusted_hosts = INJECT_RELAY_HOSTS,
  }

  shaper.setup_publish()
end)

-- Asynchronous bounces (DSNs) and complaints (ARF) arriving on the public
-- listener are logged, which sends them through the log hook, then dropped.
kumo.on('get_listener_domain', function(domain, listener, conn_meta)
  if listener == INJECT_LISTEN then
    return
  end
  return kumo.make_listener_domain {
    log_oob = 'LogThenDrop',
    log_arf = 'LogThenDrop',
  }
end)

-- DKIM keys live encrypted in Postly's database; the API hands them over on
-- the private network. Cached so a burst of mail from one domain is one call.
local fetch_dkim = kumo.memoize(function(tenant, domain)
  local client = kumo.http.build_client {}
  local response = client
    :get(string.format('%s/internal/dkim/%s/%s', API, tenant, domain))
    :header('Authorization', 'Bearer ' .. TOKEN)
    :send()
  client:close()
  if not response:status_is_success() then
    return nil
  end
  return kumo.json_parse(response:text())
end, { name = 'postly_dkim', ttl = '5 minutes', capacity = 10000 })

kumo.on('smtp_server_message_received', function(msg, conn_meta)
  -- Only mail injected by Postly carries this header; inbound bounces do not.
  msg:import_x_headers { 'x-postly-message-id', 'x-postly-tenant' }
  local message_id = msg:get_meta 'x_postly_message_id'
  if not message_id then
    return
  end
  local tenant = msg:get_meta 'x_postly_tenant'
  msg:set_meta('tenant', tenant)
  -- The tenant id is ours; recipients do not need it.
  msg:remove_all_named_headers 'X-Postly-Tenant'

  local from = msg:from_header()
  local key = from and tenant and fetch_dkim(tenant, string.lower(from.domain))
  if not key then
    kumo.reject(451, '4.7.0 no DKIM key for this sender yet')
  end
  local signer = kumo.dkim.rsa_sha256_signer {
    domain = key.domain,
    selector = key.selector,
    headers = { 'From', 'To', 'Cc', 'Subject', 'Date', 'Message-ID', 'Reply-To', 'MIME-Version', 'Content-Type' },
    key = { key_data = key.private_key },
  }
  msg:dkim_sign(signer)
end)

kumo.on('get_queue_config', function(domain, tenant, campaign, routing_domain)
  if string.find(domain, '%.log_hook$') then
    return
  end
  local params = {
    -- Transactional mail that is a day late is usually worse than a bounce.
    max_age = '1 day',
    retry_interval = '1m',
    max_retry_interval = '30m',
  }
  if SMART_HOST then
    local host = string.match(SMART_HOST, '^([^:]+)')
    params.protocol = { smtp = { mx_list = { host } } }
  end
  return kumo.make_queue_config(params)
end)

kumo.on('get_egress_path_config', function(domain, egress_source, site_name)
  local config = shaper.get_egress_path_config(domain, egress_source, site_name)
  if SMART_HOST then
    -- Mailpit in development: plain SMTP on its own port.
    local port = tonumber(string.match(SMART_HOST, ':(%d+)$') or '25')
    return kumo.make_egress_path {
      smtp_port = port,
      enable_tls = 'Disabled',
      ehlo_domain = HOSTNAME,
    }
  end
  return config
end)

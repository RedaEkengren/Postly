--[[
  Traffic-shaping automation daemon (tsa-daemon), production only. kumod
  publishes delivery outcomes to it and subscribes to the resulting actions,
  such as suspending Gmail for an hour after a rate-limit deferral
  (shaping.toml). Mounting deploy/kumomta over the policy directory hides the
  image's default copy of this file, so Postly carries its own.
]]
local tsa = require 'tsa'
local kumo = require 'kumo'

kumo.on('tsa_init', function()
  tsa.start_http_listener {
    listen = os.getenv 'TSA_LISTEN' or '127.0.0.1:8008',
    trusted_hosts = { '127.0.0.1', '::1' },
  }
end)

local cached_load_shaping_data = kumo.memoize(kumo.shaping.load, {
  name = 'tsa_load_shaping_data',
  ttl = '5 minutes',
  capacity = 4,
})

kumo.on('tsa_load_shaping_data', function()
  return cached_load_shaping_data {
    '/opt/kumomta/share/policy-extras/shaping.toml',
    '/opt/kumomta/etc/policy/shaping.toml',
  }
end)

import { Link } from "@tanstack/react-router";
import * as React from "react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span className="inline-block h-2 w-2 rounded-full bg-primary" />
      <span className="text-lg">Postly</span>
    </Link>
  );
}

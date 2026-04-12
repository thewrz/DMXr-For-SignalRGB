/**
 * DMX-C1: lightweight IPv4-only CIDR matcher for the UDP source allow-list.
 * No external dependencies. IPv6 addresses return false (deny by default).
 */

function ipToUint32(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  // Ensure unsigned 32-bit
  return result >>> 0;
}

function parseCidr(cidr: string): { network: number; mask: number } | null {
  const [networkStr, bitsStr] = cidr.split("/");
  if (!networkStr || !bitsStr) return null;

  const bits = Number(bitsStr);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return null;

  const network = ipToUint32(networkStr);
  if (network === null) return null;

  // Shift left then unsigned-right-shift to get a 32-bit mask
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return { network: (network & mask) >>> 0, mask };
}

/**
 * Returns true if `ip` falls within any of the CIDR ranges in `allowList`.
 * IPv6 addresses and malformed CIDRs are silently rejected (return false).
 */
export function matchCidr(ip: string, allowList: readonly string[]): boolean {
  const addr = ipToUint32(ip);
  if (addr === null) return false;

  for (const cidr of allowList) {
    const parsed = parseCidr(cidr);
    if (!parsed) continue;
    if ((addr & parsed.mask) >>> 0 === parsed.network) return true;
  }

  return false;
}

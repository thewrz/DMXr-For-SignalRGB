/**
 * Standalone ArtNet listener for debugging DMXr output.
 *
 * Usage: npx tsx server/scripts/artnet-listener.ts [port] [universe]
 *
 * Listens for ArtNet packets and prints active (non-zero) channels.
 * Default: port 6454, universe 0.
 */
import dmxnet from "dmxnet";

const listenPort = parseInt(process.argv[2] ?? "6454", 10);
const universe = parseInt(process.argv[3] ?? "0", 10);

const net = new dmxnet.dmxnet({
  listen: listenPort,
  log: { level: "warn" },
});

const rx = net.newReceiver({ subnet: 0, universe, net: 0 });

rx.on("data", (data: Buffer) => {
  const active: Record<number, number> = {};
  for (let i = 0; i < data.length; i++) {
    if (data[i] > 0) {
      active[i + 1] = data[i];
    }
  }
  if (Object.keys(active).length > 0) {
    console.log("DMX:", active);
  }
});

console.log(`Listening for ArtNet on port ${listenPort}, universe ${universe}...`);
console.log("Press Ctrl+C to stop.\n");

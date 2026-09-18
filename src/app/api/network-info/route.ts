import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
  try {
    const interfaces = os.networkInterfaces();
    const networkList: { name: string; address: string; url: string; isWifi: boolean }[] = [];
    const port = process.env.PORT || "3000";

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        // نأخذ عناوين IPv4 غير الداخلية (non-internal)
        if (addr.family === "IPv4" && !addr.internal) {
          const isWifi =
            name.toLowerCase().includes("wi-fi") ||
            name.toLowerCase().includes("wlan") ||
            name.toLowerCase().includes("wireless");

          networkList.push({
            name,
            address: addr.address,
            url: `http://${addr.address}:${port}`,
            isWifi,
          });
        }
      }
    }

    // ترتيب بحيث تكون شبكة الواي فاي أو العناوين الشائعة (192.168.x.x) في البداية
    networkList.sort((a, b) => {
      if (a.isWifi && !b.isWifi) return -1;
      if (!a.isWifi && b.isWifi) return 1;
      if (a.address.startsWith("192.168.") && !b.address.startsWith("192.168.")) return -1;
      return 0;
    });

    const defaultUrl = networkList.length > 0 ? networkList[0].url : `http://localhost:${port}`;
    const hostname = os.hostname();

    return NextResponse.json({
      hostname,
      port,
      interfaces: networkList,
      defaultUrl,
      localDomainUrl: `http://${hostname.toLowerCase()}.local:${port}`,
    });
  } catch (e) {
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

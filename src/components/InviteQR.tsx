import QRCode from "qrcode";
import { tri, type Locale } from "@/lib/i18n";

/** Generated on our server: the single-use invitation never goes to a QR service. */
export async function InviteQR({ url, name, loc, open = false }: { url: string; name: string; loc: Locale; open?: boolean }) {
  const qr = await QRCode.toDataURL(url, { width: 320, margin: 4, errorCorrectionLevel: "M", color: { dark: "#091422", light: "#ffffff" } });
  return <details className="invite-qr" open={open}>
    <summary className="btn pri">{tri(loc, "Arată QR pentru activare|Show activation QR|Pokaż kod QR aktywacji")}</summary>
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL, no image optimization or external service */}
      <img src={qr} width={320} height={320} alt={tri(loc, `Invitație pentru ${name}|Invitation for ${name}|Zaproszenie dla ${name}`)} />
      <figcaption><strong>{name}</strong><p>{tri(loc, "Scanează cu camera telefonului, deschide linkul și alege PIN-ul de 6 cifre. Nu ai nevoie de SMS; funcționează și prin Wi-Fi.|Scan with your phone camera, open the link and choose a 6-digit PIN. No SMS needed; Wi-Fi works too.|Zeskanuj aparatem telefonu, otwórz link i wybierz 6-cyfrowy PIN. Bez SMS; działa przez Wi-Fi.")}</p><small>{tri(loc, "Valabil 14 zile de la creare, pentru o singură activare. Arată codul doar șoferului invitat.|Valid for 14 days from creation, for one activation. Show only to the invited driver.|Ważny 14 dni od utworzenia, do jednej aktywacji. Pokaż tylko zaproszonemu kierowcy.")}</small></figcaption>
    </figure>
  </details>;
}

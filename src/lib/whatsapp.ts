const API_KEY = import.meta.env.VITE_CALLMEBOT_API_KEY as string;
const PHONE = import.meta.env.VITE_CALLMEBOT_PHONE_NUMBER as string;

export async function sendWhatsApp(message: string): Promise<boolean> {
  if (!API_KEY || !PHONE) return false;
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${PHONE}&text=${encodeURIComponent(message)}&apikey=${API_KEY}`;
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

export async function notifyLowStock(productName: string, stock: number, minStock: number, unit: string): Promise<boolean> {
  const msg = `⚠️ *Stock bajo en sonder*\nProducto: ${productName}\nStock actual: ${stock} ${unit}\nStock mínimo: ${minStock} ${unit}`;
  return sendWhatsApp(msg);
}

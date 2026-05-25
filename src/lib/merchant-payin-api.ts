import { createPublicPayIn } from "@/lib/public-payin-create";
import {
  merchantError,
  merchantSuccess,
  txToMerchantPayinData,
  type MerchantPayinCreateData,
} from "@/lib/merchant-payin-map";

export type { MerchantPayinCreateData, MerchantPayinStatusData } from "@/lib/merchant-payin-map";
export {
  merchantError,
  merchantSuccess,
  txToMerchantPayinData,
  txToMerchantPayinStatusData,
} from "@/lib/merchant-payin-map";

export type MerchantPayinCreateInput = {
  amount: number;
  return_url?: string | null;
  note?: string | null;
  method?: "UPI" | "BANK" | null;
};

export async function createMerchantPayIn(
  company: { id: number; company_code: string | null },
  input: MerchantPayinCreateInput,
  origin: string,
) {
  const companyCode = company.company_code?.trim() || "";
  if (!companyCode) {
    return merchantError("Merchant not found", 404);
  }

  const note = input.note?.trim() || "";
  const method = (input.method === "BANK" ? "BANK" : "UPI") as "UPI" | "BANK";
  const result = await createPublicPayIn(
    { id: company.id, status: "ACTIVE" },
    {
      amount: input.amount,
      return_url: input.return_url ?? undefined,
      note: note || undefined,
      client_name: note || "API PayIn",
      method,
    },
  );

  if (!result.ok) {
    const msg = result.body.error;
    if (result.status === 400) return merchantError(msg, 400);
    if (result.status === 503) return merchantError(msg || "Banker not found", 404);
    return merchantError(msg, result.status);
  }

  const req = result.body.request;
  const data = txToMerchantPayinData(
    {
      id: req.id as string,
      order_id: String(req.orderId ?? ""),
      amount: req.amount as number,
      status: String(req.status ?? "PENDING"),
      assigned_upi: String(req.assignedUpi ?? ""),
      utr_code: String(req.utrCode ?? ""),
      payment_image: null,
      user_note: note || null,
    },
    {
      origin,
      companyCode,
      return_url: input.return_url ?? null,
      forceStatus: "INITIATE",
    },
  );

  if (!data.upi) {
    return merchantError("Banker not found", 404);
  }

  return {
    body: merchantSuccess("Payin request created successfully", data),
    status: 200,
  };
}

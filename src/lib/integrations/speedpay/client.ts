type JsonRecord = Record<string, unknown>;

export type SpeedpayInitPayinInput = {
  amount: number;
  note?: string;
  return_url?: string;
};

export type SpeedpayInitPayinResponse = {
  success: boolean;
  message?: string;
  data?: {
    id: number;
    reference_number: string | null;
    transaction_number: string;
    upi: string;
    redirect_url: string;
    return_url?: string | null;
    amount: number | string;
    status: string;
    image?: string | null;
    note?: string | null;
  };
};

export type SpeedpayPayinStatusResponse = {
  success: boolean;
  message?: string;
  data?: {
    id: number;
    reference_number: string | null;
    transaction_number: string;
    upi: string;
    amount: string;
    status: string;
    image?: string | null;
    note?: string | null;
  };
};

function readConfig() {
  const baseUrl = process.env.SPEEDPAY_BASE_URL?.trim();
  const apiKey = process.env.SPEEDPAY_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    throw new Error("SPEEDPAY config missing");
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, apiKey } = readConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as JsonRecord;
  if (!res.ok) {
    console.error("Speedpay request failed", json);
    const msg = typeof json.message === "string" ? json.message : "Speedpay request failed";
    throw new Error(msg);
  }
  return json as T;
}

export async function speedpayInitializePayin(input: SpeedpayInitPayinInput): Promise<SpeedpayInitPayinResponse> {
  return requestJson<SpeedpayInitPayinResponse>("", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Log only on failure
function logIfFailed(json: JsonRecord, ok: boolean) {
  if (!ok) console.error("Speedpay request failed", json);
}export async function speedpayGetPayinStatusById(id: number): Promise<SpeedpayPayinStatusResponse> {
  return requestJson<SpeedpayPayinStatusResponse>(`/payin/status/${id}`, {
    method: "GET",
  });
}

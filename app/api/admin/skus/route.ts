import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin";
import { getAdminAccessToken } from "@/lib/graph";

export async function GET() {
  try {
    requireAdminSession();
  } catch (err) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const accessToken = await getAdminAccessToken();
    const res = await fetch("https://graph.microsoft.com/v1.0/subscribedSkus", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `获取 SKU 失败：${res.status} ${text}` },
        { status: 400 }
      );
    }
    const data = (await res.json()) as {
      value: Array<{
        skuId: string;
        skuPartNumber: string;
        capabilityStatus?: string;
        consumedUnits?: number;
        prepaidUnits?: { enabled?: number };
        servicePlans?: Array<{ servicePlanName: string; provisioningStatus?: string }>;
      }>;
    };

    const mapped = data.value.map((item) => ({
      skuId: item.skuId,
      name: item.skuPartNumber,
      capabilityStatus: item.capabilityStatus ?? "",
      consumedUnits: item.consumedUnits ?? 0,
      enabled: item.prepaidUnits?.enabled ?? 0,
      servicePlans: (item.servicePlans || []).map((p) => ({
        name: p.servicePlanName,
        status: p.provisioningStatus ?? ""
      }))
    }));

    return NextResponse.json({ skus: mapped });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

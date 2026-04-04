import Product, { IProduct } from '../models/Product';

const LEGACY_NEW_ARRIVAL_DAYS = 4;

/** Start of local day */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * True if any batch has stock and newArrivalUntil is on or after today (date-only compare).
 */
export function hasActiveNewArrivalBatch(product: Pick<IProduct, 'inventory'>): boolean {
  const today = startOfToday();
  for (const inv of product.inventory || []) {
    for (const b of inv.batches || []) {
      if ((b.quantity || 0) <= 0) continue;
      if (!b.newArrivalUntil) continue;
      const u = new Date(b.newArrivalUntil as Date);
      u.setHours(0, 0, 0, 0);
      if (u.getTime() >= today.getTime()) return true;
    }
  }
  return false;
}

/** Mutates product: sets isNewArrival from batch newArrivalUntil rules */
export function syncProductIsNewArrival(product: IProduct & { isNewArrival?: boolean }): void {
  product.isNewArrival = hasActiveNewArrivalBatch(product);
}

/** Clear stale isNewArrival: batch dates drive truth; legacy uses createdAt age when no batch dates exist */
export async function expireStaleNewArrivalFlags(): Promise<void> {
  const cutoffDate = new Date(Date.now() - LEGACY_NEW_ARRIVAL_DAYS * 24 * 60 * 60 * 1000);
  const products = await Product.find({ isNewArrival: true }).select('inventory createdAt');
  for (const doc of products) {
    const p = doc.toObject() as any;
    if (hasActiveNewArrivalBatch(p)) continue;
    const anyBatchHasNewArrivalDate = p.inventory?.some((inv: any) =>
      inv.batches?.some((b: any) => b?.newArrivalUntil)
    );
    if (anyBatchHasNewArrivalDate) {
      doc.isNewArrival = false;
      await doc.save();
    } else if (p.createdAt && new Date(p.createdAt) < cutoffDate) {
      doc.isNewArrival = false;
      await doc.save();
    }
  }
}

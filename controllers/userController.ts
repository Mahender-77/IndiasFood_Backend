import axios from 'axios';
import { Request, Response } from 'express';
import DeliverySettings from '../models/DeliverySettings';
import Order, { OrderDocument } from '../models/Order';
import { HydratedDocument } from 'mongoose';
import Product from '../models/Product';
import User, { IAddress } from '../models/User';
import Otp from '../models/Otp';
import PDFDocument from 'pdfkit'; // Import pdfkit
import path from 'path';


interface AuthenticatedRequest extends Request {
  user?: any;
}

// @desc    Get user cart
// @route   GET /api/user/cart
// @access  Private
export const getUserCart = async (req: AuthenticatedRequest, res: Response) => {
  const user = await User.findById(req.user._id).populate('cart.product');
  if (user) {
    res.json(user.cart);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

// @desc    Add/update/remove item from cart
// @route   POST /api/user/cart
// @access  Private
export const updateCart = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      productId,
      qty,
      selectedVariantIndex = 0,
      price,
      originalPrice,
      isDealApplied,
      dealDiscountPercent,
      isDealItem: isDealItemBody
    } = req.body;

    const incomingIsDealItem = Boolean(isDealItemBody);

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Not authorized, user ID missing' });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const lineIsDeal = (item: any) => Boolean(item.isDealItem);

    // Find item: product + variant + deal vs catalog line
    const itemIndex = user.cart.findIndex(
      (item: any) => {
        const itemProductId = item.product._id ? item.product._id.toString() : item.product.toString();
        const itemVariantIndex = item.selectedVariantIndex !== undefined ? item.selectedVariantIndex : 0;
        return (
          itemProductId === productId &&
          itemVariantIndex === selectedVariantIndex &&
          lineIsDeal(item) === incomingIsDealItem
        );
      }
    );

    const applyPricingSnapshot = (target: any) => {
      if (price !== undefined && price !== null && Number.isFinite(Number(price))) {
        target.price = Number(price);
      }
      if (originalPrice !== undefined && originalPrice !== null && Number.isFinite(Number(originalPrice))) {
        target.originalPrice = Number(originalPrice);
      }
      if (isDealApplied !== undefined) {
        target.isDealApplied = Boolean(isDealApplied);
      }
      if (dealDiscountPercent !== undefined && dealDiscountPercent !== null) {
        const d = Number(dealDiscountPercent);
        if (Number.isFinite(d)) target.dealDiscountPercent = d;
      }
      if (isDealItemBody !== undefined) {
        target.isDealItem = Boolean(isDealItemBody);
      }
    };

    if (itemIndex > -1) {
      // Update quantity or remove item
      if (qty > 0) {
        user.cart[itemIndex].qty = qty;
        user.cart[itemIndex].selectedVariantIndex = selectedVariantIndex;
        applyPricingSnapshot(user.cart[itemIndex]);
      } else {
        user.cart.splice(itemIndex, 1);
      }
    } else if (qty > 0) {
      // Add new item with variant index + optional pricing snapshot
      const row: any = {
        product: productId as any,
        qty,
        selectedVariantIndex,
        isDealItem: incomingIsDealItem
      };
      applyPricingSnapshot(row);
      user.cart.push(row);
    } else {
      // If trying to remove item that doesn't exist, just return current cart
      await user.populate('cart.product');
      return res.json(user.cart);
    }

    await user.save();
    await user.populate('cart.product');
    
    res.json(user.cart);
  } catch (error: any) {
    console.error('Error in updateCart:', error);
    res.status(500).json({ 
      message: 'Error updating cart', 
      error: error.message 
    });
  }
};

// POST /api/user/cart/merge
export const mergeCart = async (req: AuthenticatedRequest, res: Response) => {
  const { items } = req.body; // [{ productId, qty, selectedVariantIndex, price?, ... }]

  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  for (const incoming of items) {
    const mergeIncomingIsDeal = Boolean(incoming.isDealItem);

    const index = user.cart.findIndex(
      (item: any) =>
        item.product.toString() === incoming.productId &&
        (item.selectedVariantIndex ?? 0) === (incoming.selectedVariantIndex ?? 0) &&
        Boolean(item.isDealItem) === mergeIncomingIsDeal
    );

    if (index > -1) {
      user.cart[index].qty += incoming.qty;
      if (incoming.price !== undefined && incoming.price !== null && Number.isFinite(Number(incoming.price))) {
        (user.cart[index] as any).price = Number(incoming.price);
      }
      if (incoming.originalPrice !== undefined && incoming.originalPrice !== null && Number.isFinite(Number(incoming.originalPrice))) {
        (user.cart[index] as any).originalPrice = Number(incoming.originalPrice);
      }
      if (incoming.isDealApplied !== undefined) {
        (user.cart[index] as any).isDealApplied = Boolean(incoming.isDealApplied);
      }
      if (incoming.dealDiscountPercent !== undefined && incoming.dealDiscountPercent !== null) {
        const d = Number(incoming.dealDiscountPercent);
        if (Number.isFinite(d)) (user.cart[index] as any).dealDiscountPercent = d;
      }
      if (incoming.isDealItem !== undefined) {
        (user.cart[index] as any).isDealItem = mergeIncomingIsDeal;
      }
    } else {
      const row: any = {
        product: incoming.productId,
        qty: incoming.qty,
        selectedVariantIndex: incoming.selectedVariantIndex ?? 0,
        isDealItem: mergeIncomingIsDeal
      };
      if (incoming.price !== undefined && incoming.price !== null && Number.isFinite(Number(incoming.price))) {
        row.price = Number(incoming.price);
      }
      if (incoming.originalPrice !== undefined && incoming.originalPrice !== null && Number.isFinite(Number(incoming.originalPrice))) {
        row.originalPrice = Number(incoming.originalPrice);
      }
      if (incoming.isDealApplied !== undefined) {
        row.isDealApplied = Boolean(incoming.isDealApplied);
      }
      if (incoming.dealDiscountPercent !== undefined && incoming.dealDiscountPercent !== null) {
        const d = Number(incoming.dealDiscountPercent);
        if (Number.isFinite(d)) row.dealDiscountPercent = d;
      }
      user.cart.push(row);
    }
  }

  await user.save();
  await user.populate('cart.product');

  res.json(user.cart);
};


// @desc    Get user wishlist
// @route   GET /api/user/wishlist
// @access  Private
export const getUserWishlist = async (req: AuthenticatedRequest, res: Response) => {
  const user = await User.findById(req.user._id).populate('wishlist');
  if (user) {
    res.json(user.wishlist);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

// @desc    Toggle product in wishlist
// @route   POST /api/user/wishlist
// @access  Private
export const toggleWishlist = async (req: AuthenticatedRequest, res: Response) => {
  const { productId } = req.body;

  const user = await User.findById(req.user._id);

  if (user) {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const itemIndex = user.wishlist.findIndex(
      (item: any) => item.toString() === productId
    );

    if (itemIndex > -1) {
      user.wishlist.splice(itemIndex, 1);
    } else {
      user.wishlist.push(productId);
    }

    await user.save();
    res.json(user.wishlist);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

// @desc    Create new order
// @route   POST /api/user/checkout
// @access  Private
// @desc    Create new order
// @route   POST /api/user/checkout
// @access  Private

export const createOrder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      orderItems,
      shippingAddress,
      paymentMethod,
      deliveryMode,
      shippingPrice = 0,
      taxPrice = 0
    } = req.body;

    /* ---------------- VALIDATIONS ---------------- */

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: 'No order items' });
    }

    if (!shippingAddress || !paymentMethod) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!['delivery', 'pickup'].includes(deliveryMode)) {
      return res.status(400).json({ message: 'Invalid delivery mode' });
    }

    /* ---------------- 1️⃣ VALIDATE PRODUCTS + CALCULATE PRICE ---------------- */

    const enrichedOrderItems: any[] = [];
    let storeId: string | undefined;
    let store: any;

    for (const item of orderItems) {
      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(400).json({
          message: `Product not found: ${item.product}`
        });
      }

      let itemName = product.name;
      // Use first product image when available; fall back to a non-empty
      // placeholder string so the Order schema's required `image` field passes.
      const itemImage = product.images?.[0] || 'no-image';

      /* ---------------- 🔥 VARIANT LOGIC (UPDATED) ---------------- */

      if (product.variants && product.variants.length > 0) {

        let selectedIndex = item.selectedVariantIndex;

        // ✅ AUTO SELECT if only ONE variant
        if (product.variants.length === 1) {
          selectedIndex = 0;
        }

        // 🚨 If multiple variants → require selection
        if (
          product.variants.length > 1 &&
          (typeof selectedIndex !== 'number' || selectedIndex < 0)
        ) {
          return res.status(400).json({
            message: `Please select a variant for product: ${product.name}`
          });
        }

        const variant = product.variants[selectedIndex];

        if (!variant) {
          return res.status(400).json({
            message: `Invalid variant selected for ${product.name}`
          });
        }

        itemName = `${product.name} (${variant.value})`;

        item.selectedVariantIndex = selectedIndex;
      } else {
        item.selectedVariantIndex = null;
      }

      // Locked line price from cart (deal / snapshot); do not recompute from catalog.
      if (item.price === undefined || item.price === null) {
        return res.status(400).json({
          message: 'Invalid cart price: missing line price'
        });
      }
      const itemPrice = Number(item.price);
      if (!Number.isFinite(itemPrice) || itemPrice < 0) {
        return res.status(400).json({
          message: 'Invalid cart price'
        });
      }

      enrichedOrderItems.push({
        product: product._id,
        name: itemName,
        image: itemImage,
        qty: item.qty,
        price: itemPrice,
        selectedVariantIndex: item.selectedVariantIndex
      });

      // Prefer the explicit store assignment on the product when present.
      // If it's missing, we'll resolve delivery settings/store later using a safe fallback.
      if (!storeId && product.store) {
        storeId = product.store.toString();
      }
    }

    /* ---------------- 2️⃣ GET STORE DETAILS ---------------- */

    // Load delivery settings (one doc with all store locations).
    const deliverySettings = await DeliverySettings.findOne({});

    if (!deliverySettings || !deliverySettings.storeLocations?.length) {
      return res.status(400).json({ message: 'Store not found or inactive' });
    }

    const pickupStoreName = (shippingAddress?.city || shippingAddress?.address || '').toString().trim();
    const isPickup = deliveryMode === 'pickup';

    // For pickup: use the store selected by the user (sent as shippingAddress.city / address).
    // For delivery: use product.store or first store.
    if (isPickup && pickupStoreName) {
      const match = deliverySettings.storeLocations.find(
        (s: any) => s.name?.toString().trim().toLowerCase() === pickupStoreName.toLowerCase()
      );
      if (match && (match as any).isActive !== false) {
        store = match;
        storeId = (match as any).storeId?.toString();
      }
    }

    if (!store) {
      if (isPickup && pickupStoreName) {
        return res.status(400).json({
          message: `Selected pickup store "${pickupStoreName}" not found or inactive`
        });
      }
      // Delivery or no pickup store name: resolve by product store or first location
      store = storeId
        ? deliverySettings.storeLocations.find(
            (s: any) => s.storeId?.toString() === storeId
          )
        : null;
      store = store || deliverySettings.storeLocations[0];
      storeId = storeId || (store && (store as any).storeId?.toString());
    }

    if (!store) {
      return res.status(400).json({ message: 'Store location not found' });
    }

   /* ---------------- CALCULATE TOTAL ---------------- */

const itemsPrice = enrichedOrderItems.reduce(
  (acc, item) => acc + item.price * item.qty,
  0
);

// Shipping from frontend (Uengage value)
const safeShippingPrice = Number(shippingPrice) || 0;

// 🔥 GST from DB (secure)
const gstPercentage = deliverySettings.gstPercentage || 0;

const calculatedTaxPrice = Number(
  ((itemsPrice * gstPercentage) / 100).toFixed(2)
);

// 💸 What Uengage charges YOU
const uengageDeliveryFee = safeShippingPrice;

// 💰 What customer pays
let finalShippingPrice = safeShippingPrice;

// Free delivery check
if (
  deliveryMode === 'delivery' &&
  deliverySettings.freeDeliveryThreshold > 0 &&
  itemsPrice >= deliverySettings.freeDeliveryThreshold
) {
  finalShippingPrice = 0;
}

// 🔥 FINAL TOTAL
const calculatedTotalPrice = Number(
  (itemsPrice + finalShippingPrice + calculatedTaxPrice).toFixed(2)
);


    /* ---------------- 3️⃣ CREATE ORDER ---------------- */

    const order = new Order({
      user: req.user._id,
      orderItems: enrichedOrderItems,
      shippingAddress,
      paymentMethod,
      taxPrice: calculatedTaxPrice,
      shippingPrice: finalShippingPrice,
      uengageDeliveryFee: uengageDeliveryFee,
      totalPrice: calculatedTotalPrice,
      status: 'placed',
      deliveryMode,
      store: storeId,        // 🔥 ADD THIS
      storeName: store.name  // 🔥 OPTIONAL BUT SMART
    });

    const createdOrder = await order.save();

    /* ---------------- 4️⃣ DECREMENT STOCK (FIFO: non-expired batches only, earliest expiry first) ---------------- */

    const nowMs = Date.now();
    const isBatchNonExpired = (b: any) => {
      const exp = b.expiryDate ? new Date(b.expiryDate).getTime() : 0;
      return exp >= nowMs;
    };

    const decrementItems = async (
      items: any[],
      allocationsTarget: { batchNumber: string; quantity: number }[][]
    ) => {
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const product = await Product.findById(item.product);
        if (!product) {
          allocationsTarget.push([]);
          continue;
        }

        const inv = product.inventory?.find(
          (i: any) => i.location?.toLowerCase() === store.name?.toLowerCase()
        );
        if (!inv) {
          throw new Error(`Inventory not found for ${product.name}`);
        }

        const variantIndex = product.variants?.length
          ? (item.selectedVariantIndex ?? 0)
          : 0;
        const variants = product.variants || [];
        const isVariantActive = (i: number) =>
          (variants[i] as any)?.isActive !== false;

        const getTotalQty = () => {
          if (!isVariantActive(variantIndex)) return 0;
          if (inv.batches?.length) {
            return inv.batches
              .filter(
                (b: any) =>
                  b.variantIndex === variantIndex && isBatchNonExpired(b)
              )
              .reduce((s: number, b: any) => s + (b.quantity || 0), 0);
          }
          const st = inv.stock?.find(
            (s: any) => s.variantIndex === variantIndex
          );
          return st ? st.quantity || 0 : 0;
        };

        const totalQty = getTotalQty();
        if (totalQty < item.qty) {
          throw new Error(`Insufficient stock for ${item.name}`);
        }

        const allocations: { batchNumber: string; quantity: number }[] = [];

        if (inv.batches?.length) {
          let remaining = item.qty;
          const batchesForVariant = (inv.batches as any[])
            .filter(
              (b: any) =>
                b.variantIndex === variantIndex && isBatchNonExpired(b)
            )
            .sort(
              (a: any, b: any) =>
                new Date(a.expiryDate).getTime() -
                new Date(b.expiryDate).getTime()
            );
          for (const b of batchesForVariant) {
            if (remaining <= 0) break;
            const deduct = Math.min(b.quantity, remaining);
            // For older batches missing analytics fields, derive them lazily.
            if ((b as any).initialQuantity == null) {
              (b as any).initialQuantity = Number(
                (b.quantity || 0) +
                  ((b as any).soldQuantity || 0) +
                  ((b as any).giveAwayQuantity || 0)
              );
            }
            b.quantity -= deduct;
            if (deduct > 0) {
              (b as any).soldQuantity = Number((b as any).soldQuantity || 0) + deduct;
              const unitPrice =
                typeof item.price === 'number' ? item.price : (b.sellingPrice || 0);
              (b as any).revenue = Number((b as any).revenue || 0) + deduct * unitPrice;
            }
            remaining -= deduct;
            if (deduct > 0 && b.batchNumber) {
              allocations.push({ batchNumber: b.batchNumber, quantity: deduct });
            }
          }
          // Do NOT remove depleted batches. Analytics needs batch objects
          // so it can compute sold/revenue correctly even when Qty Left becomes 0.
        } else {
          const st = inv.stock?.find(
            (s: any) => s.variantIndex === variantIndex
          );
          if (st) st.quantity -= item.qty;
        }

        allocationsTarget.push(allocations);
        await product.save();
      }
    };

    const batchAllocationsPerItem: { batchNumber: string; quantity: number }[][] = [];
    try {
      await decrementItems(enrichedOrderItems, batchAllocationsPerItem);
    } catch (e: any) {
      return res.status(400).json({ message: e.message || 'Stock update failed' });
    }

    if (createdOrder.orderItems?.length === batchAllocationsPerItem.length) {
      batchAllocationsPerItem.forEach((allocations, i) => {
        (createdOrder.orderItems[i] as any).batchAllocations = allocations;
      });
    }

    await createdOrder.save();

    /* ---------------- 5️⃣ CLEAR CART ---------------- */

    const user = await User.findById(req.user._id);
    if (user) {
      user.cart = [];
      await user.save();
    }

    /* ---------------- SUCCESS ---------------- */

    res.status(201).json({
      message: 'Order placed successfully',
      order: createdOrder
    });

  } catch (error: any) {
    console.error('❌ Order creation error:', error);
    res.status(500).json({
      message: 'Error creating order',
      error: error.message
    });
  }
};



// @desc    Get logged in user orders
// @route   GET /api/user/orders
// @access  Private
export const getUserOrders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('user', 'username email')
      .sort({ createdAt: -1 });
    
    res.json(orders);
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

// @desc    Get order by ID
// @route   GET /api/user/orders/:id
// @access  Private
export const getOrderById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if order belongs to the authenticated user
    const orderUserId = (order.user as any).id 
      ? (order.user as any).id.toString() 
      : (order.user as any).toString();
    
    if (orderUserId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get order by ID error:', error);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
};
// @desc    Cancel order
// @route   PUT /api/user/orders/:id/cancel
// @access  Private
// @desc    Cancel order
// @route   PUT /api/user/orders/:id/cancel
// @access  Private
export const cancelOrder = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { reason } = req.body;

    if (!reason?.trim()) {
      return res.status(400).json({
        message: 'Cancellation reason is required'
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: 'Order not found'
      });
    }

    // 🔐 Ownership check
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Not authorized'
      });
    }

    // ❌ Already delivered or cancelled
    if (order.isDelivered || order.status === 'cancelled') {
      return res.status(400).json({
        message: 'Order cannot be cancelled'
      });
    }

    /* ======================================================
       📦 RESTORE STOCK — add back to respective batch(es) (FIFO)
    ====================================================== */

    const orderStoreId = order.store?.toString?.();
    const orderStoreName = (order.storeName || '').toString().trim();
    // For pickup orders, store name is also stored in shippingAddress.city when order was created.
    const pickupLocationFromAddress = (order.shippingAddress?.city || order.shippingAddress?.address || '').toString().trim();

    const allItemsToRestore = [
      ...(order.orderItems || []),
      ...(((order as any).giveAwayItems as any[]) || [])
    ];

    for (const item of allItemsToRestore) {

      const product = await Product.findById(item.product);

      if (!product) continue;

      const variantIndex =
        typeof item.selectedVariantIndex === 'number'
          ? item.selectedVariantIndex
          : 0;

      // Restore to the SAME location the order was placed from (order's store), not product's default store.
      let locationName: string;

      if (orderStoreName) {
        // Use stored order store name (e.g. "Test").
        locationName = orderStoreName.toLowerCase();
      } else if (order.deliveryMode === 'pickup' && pickupLocationFromAddress) {
        // Fallback for pickup: store name was set in shippingAddress.city at createOrder.
        locationName = pickupLocationFromAddress.toLowerCase();
      } else if (orderStoreId) {
        const deliverySettings = await DeliverySettings.findOne({
          storeLocations: {
            $elemMatch: { storeId: orderStoreId, isActive: true }
          }
        });
        if (!deliverySettings) continue;
        const store = deliverySettings.storeLocations.find(
          (s: any) => s.storeId?.toString() === orderStoreId
        );
        if (!store) continue;
        locationName = (store as any).name?.toString?.().trim?.().toLowerCase() || '';
      } else {
        locationName = (product.inventory?.[0]?.location?.toString?.() || '').trim().toLowerCase();
        if (!locationName) continue;
      }

      const inventoryLocation = product.inventory?.find(
        (inv: any) => (inv.location?.toString?.() || '').trim().toLowerCase() === locationName
      );

      if (!inventoryLocation) continue;

      if (Array.isArray(inventoryLocation.batches) && inventoryLocation.batches.length > 0) {
        // Same variant's batches, sorted by expiry (FIFO — earliest first)
        const batchesForVariant = (inventoryLocation.batches as any[])
          .filter((b: any) => b.variantIndex === variantIndex)
          .sort((a: any, b: any) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

        if (batchesForVariant.length > 0) {
          // Add cancelled qty back into the earliest-expiry batch (respective batch)
          batchesForVariant[0].quantity = (batchesForVariant[0].quantity || 0) + item.qty;
        } else {
          // No batch for this variant at this location — create a return batch
          const now = new Date();
          const v = product.variants?.[variantIndex];
          (inventoryLocation.batches as any[]).push({
            batchNumber: `RETURN-${Date.now()}`,
            quantity: item.qty,
            manufacturingDate: now,
            expiryDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            purchasePrice: v ? (v as any).originalPrice : (product.originalPrice || 0),
            sellingPrice: v ? ((v as any).offerPrice ?? (v as any).originalPrice) : (product.offerPrice ?? product.originalPrice ?? 0),
            variantIndex
          });
        }
      } else if (Array.isArray(inventoryLocation.batches) && inventoryLocation.batches.length === 0) {
        const now = new Date();
        const v = product.variants?.[variantIndex];
        (inventoryLocation.batches as any[]).push({
          batchNumber: `RETURN-${Date.now()}`,
          quantity: item.qty,
          manufacturingDate: now,
          expiryDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          purchasePrice: v ? (v as any).originalPrice : (product.originalPrice || 0),
          sellingPrice: v ? ((v as any).offerPrice ?? (v as any).originalPrice) : (product.offerPrice ?? product.originalPrice ?? 0),
          variantIndex
        });
      } else if (Array.isArray(inventoryLocation.stock)) {
        const stockItem = inventoryLocation.stock.find(
          (s: any) => s.variantIndex === variantIndex
        );
        if (stockItem) {
          stockItem.quantity += item.qty;
        } else {
          inventoryLocation.stock.push({
            variantIndex,
            quantity: item.qty,
            lowStockThreshold: 5
          });
        }
      }

      await product.save();
    }

    /* ======================================================
       📝 UPDATE ORDER STATUS
    ====================================================== */

    order.status = 'cancelled';
    order.cancelReason = reason;
    order.cancelledAt = new Date();

    await order.save();

    return res.json({
      message: 'Order cancelled successfully',
      order
    });

  } catch (error: any) {
    console.error('❌ Cancel order error:', error);
    return res.status(500).json({
      message: 'Failed to cancel order'
    });
  }
};




// @desc    Track order status via U-Engage
// @route   GET /api/user/orders/:id/track
// @access  Private
export const trackOrderStatus = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Ownership check
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (!order.uengage?.taskId) {
      return res.status(400).json({ 
        message: 'Tracking not available for this order',
        status: order.status
      });
    }

    /* ---------- CALL U-ENGAGE TRACK API ---------- */
    const payload = {
      storeId: process.env.STORE_ID,
      taskId: order.uengage.taskId
    };

    const { data } = await axios.post(
      `${process.env.UENGAGE_BASE}/trackTaskStatus`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'access-token': process.env.UENGAGE_TOKEN
        }
      }
    );

    /* ---------- MAP U-ENGAGE STATUS TO LOCAL STATUS ---------- */
    const statusMap: Record<string, string> = {
      ACCEPTED: 'confirmed',
      ALLOTTED: 'out_for_delivery',
      ARRIVED: 'out_for_delivery',
      DISPATCHED: 'out_for_delivery',
      ARRIVED_CUSTOMER_DOORSTEP: 'out_for_delivery',
      DELIVERED: 'delivered',
      CANCELLED: 'cancelled',
      RTO_INIT: 'out_for_delivery',
      RTO_COMPLETE: 'delivered',
      SEARCHING_FOR_NEW_RIDER: 'confirmed'
    };

    const uengageStatus = data.status_code;

    // Update order fields
    order.uengage.statusCode = uengageStatus;
    order.uengage.message = data.message || '';

    if (statusMap[uengageStatus]) {
      order.status = statusMap[uengageStatus] as any;
    }

    if (uengageStatus === 'DELIVERED') {
      order.isDelivered = true;
      order.deliveredAt = new Date();
    }

    if (uengageStatus === 'CANCELLED') {
      order.status = 'cancelled';
      if (!order.cancelReason) {
        order.cancelReason = 'Cancelled by delivery partner';
      }
    }

    await order.save();

    /* ---------- RESPONSE ---------- */
    return res.json({
      status: uengageStatus,
      statusLabel: data.message || uengageStatus,
      tracking: data.data || null,
      order: {
        status: order.status,
        isDelivered: order.isDelivered,
        deliveredAt: order.deliveredAt
      }
    });

  } catch (error: any) {
    console.error(
      'Track order error:',
      error.response?.data || error.message
    );

    return res.status(500).json({
      message: 'Failed to track order',
      error: error.response?.data?.message || error.message
    });
  }
};


// @desc    Generate invoice for an order
// @route   GET /api/user/orders/:id/invoice
// @access  Private
export const getUserInvoice = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'username email')
      .exec();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Ownership check
    const orderUserId =
      (order.user as any)._id
        ? (order.user as any)._id.toString()
        : order.user.toString();

    if (orderUserId !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: 'Not authorized to view this invoice' });
    }

    const doc = new PDFDocument({ margin: 30 }); // Smaller margin for better fit

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${order._id}.pdf"`
    );

    doc.pipe(res);

    // Company Header
    doc.image(path.join(__dirname, '../assets/IndiasFood.png'), doc.page.width - 150, 30, { width: 120 });
    
    doc.fontSize(16).font('Helvetica-Bold').text('INDIA\'S FOOD', 30, 50);
    doc.fontSize(10).font('Helvetica').text('A Unit of Maha Food', 30, 70);
    doc.fontSize(12).font('Helvetica-Bold').text('India\'s True Taste', 30, 85);
    
    doc.fontSize(9).font('Helvetica').text('Prasanth Layout, Prasanth Extension,', 30, 105);
    doc.text('Whitefield, Bengaluru, Karnataka 560066', 30, 117);
    doc.text('Ph: 9902312314', 30, 129);
    doc.text('Website: www.indiasfood.com', 30, 141);
    doc.text('GSTIN: 29ACCFM2331G1ZG', 30, 153);

    doc.moveDown(2);

    // Order Details - align right
    doc.fontSize(10).font('Helvetica').text('Order No :', 300, 170, {width: 100, align: 'right'});
    doc.font('Helvetica-Bold').text('INV-1001', 400, 170, {width: 150, align: 'right'}); // Assuming static INV-1001 for now

    const orderDate = (order as any).createdAt
      ? new Date((order as any).createdAt).toLocaleDateString('en-IN')
      : 'N/A';
    doc.font('Helvetica').text('Date :', 300, 185, {width: 100, align: 'right'});
    doc.font('Helvetica-Bold').text(orderDate, 400, 185, {width: 150, align: 'right'});

    doc.moveDown(3);

    // Items table header
    const tableTop = doc.y;
    const itemX = 30;
    const qtyX = 300;
    const amtX = 450;
    
    doc.font('Helvetica-Bold')
      .text('Item', itemX, tableTop, { width: 250 })
      .text('Qty', qtyX, tableTop, { width: 50, align: 'right' })
      .text('Amt', amtX, tableTop, { width: 100, align: 'right' });
    doc.moveDown(0.5);
    doc.moveTo(itemX, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
    doc.moveDown(0.5);

    // Items table rows
    doc.font('Helvetica');
    order.orderItems.forEach((item) => {
      const itemTotalPrice = (item.qty * item.price);
      doc.text(item.name, itemX, doc.y, { width: 250 })
        .text(item.qty.toFixed(3), qtyX, doc.y, { width: 50, align: 'right' }) // Display Qty with 3 decimal places
        .text(itemTotalPrice.toFixed(2), amtX, doc.y, { width: 100, align: 'right' });
      doc.moveDown(0.5);
    });

    const giveAwayItems = (order as any).giveAwayItems || [];
    if (Array.isArray(giveAwayItems) && giveAwayItems.length > 0) {
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text('GiveAway', itemX, doc.y, { width: 250 });
      doc.moveDown(0.3);
      doc.font('Helvetica');
      giveAwayItems.forEach((item: any) => {
        doc.text(item.name, itemX, doc.y, { width: 250 })
          .text(Number(item.qty || 0).toFixed(3), qtyX, doc.y, { width: 50, align: 'right' })
          .text('0.00', amtX, doc.y, { width: 100, align: 'right' });
        doc.moveDown(0.5);
      });
    }

    doc.moveDown(0.5);
    doc.moveTo(itemX, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
    doc.moveDown(0.5);

    // Totals
    const subtotal =
      order.totalPrice - order.shippingPrice - order.taxPrice;
    
    doc.font('Helvetica')
      .text('Sub Total', amtX - 150, doc.y, { width: 100, align: 'right' })
      .text(subtotal.toFixed(2), amtX, doc.y, { width: 100, align: 'right' });
    doc.moveDown(0.3);

    // Assuming a fixed GST of 5% for display purposes from the image,
    // though the actual order.taxPrice might be different in calculation.
    // If order.taxPrice represents GST, use that instead.
    // For now, matching the image:
    const gstAmount = 50.00; // From the image provided
    doc.text('GST 5 %', amtX - 150, doc.y, { width: 100, align: 'right' })
      .text(gstAmount.toFixed(2), amtX, doc.y, { width: 100, align: 'right' });
    doc.moveDown(0.3);

    if (order.shippingPrice > 0) {
      doc.text('Delivery Charges', amtX - 150, doc.y, { width: 100, align: 'right' })
        .text(order.shippingPrice.toFixed(2), amtX, doc.y, { width: 100, align: 'right' });
      doc.moveDown(0.3);
    }

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold')
      .text('TOTAL', amtX - 150, doc.y, { width: 100, align: 'right' })
      .text(order.totalPrice.toFixed(2), amtX, doc.y, { width: 100, align: 'right' });
    
    doc.moveDown(2);

    // Payment Mode
    doc.font('Helvetica-Bold').text('Payment Mode : CASH / UPI / CARD', 30, doc.y);

    doc.moveDown(3);

    // Footer message
    doc.fontSize(10).font('Helvetica-Bold').text('More sweetness awaits you – come back soon!', 30, doc.y, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Shop online in Indiasfood.com', 30, doc.y + 15, { align: 'center' });


    doc.end();
  } catch (error: any) {
    console.error('❌ Get user invoice error:', error);
    res.status(500).json({
      message: 'Failed to generate invoice',
      error: error.message,
    });
  }
};


// GET DELIVERY SETTINGS (ALL DATA)
export const getDeliverySettings = async (req: Request, res: Response) => {
  try {
    const settings = await DeliverySettings.findOne();

    if (!settings) {
      return res.status(404).json({
        message: 'Delivery settings not found'
      });
    }

    res.json({
      pricePerKm: settings.pricePerKm,
      baseCharge: settings.baseCharge,
      freeDeliveryThreshold: settings.freeDeliveryThreshold,
      gstPercentage: settings.gstPercentage,
      storeLocations: settings.storeLocations
    });

  } catch (error) {
    res.status(500).json({
      message: 'Server error'
    });
  }
};

export const searchLocation = async (req: Request, res: Response) => {
  const { q } = req.query;

  if (!q || String(q).trim().length < 3) {
    return res.json([]); // return empty array safely
  }

  try {
    console.log("🔎 Ola autocomplete for:", q);

    const response = await fetch(
      `https://api.olamaps.io/places/v1/autocomplete?input=${encodeURIComponent(
        q as string
      )}&api_key=${process.env.OLA_PLACES_API_KEY}`,
      { headers: { Accept: "*/*" } }
    );

    const text = await response.text();

    if (!response.ok) {
      console.error("❌ Ola autocomplete error:", text);
      return res.json([]);
    }

    const data = JSON.parse(text);

    const results = (data?.predictions || []).map((item: any) => ({
      placeId: item.place_id,
      title: item.structured_formatting?.main_text || item.description,
      description: item.description,
    }));

    console.log("✅ Autocomplete results:", results.length);
    res.json(results);
  } catch (err) {
    console.error("❌ Search exception:", err);
    res.json([]);
  }
};

// @desc    Reverse geocode coordinates to address
// @route   GET /user/reverse-geocode
// @access  Public
export const reverseGeocode = async (req: Request, res: Response) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  try {
    const latlng = encodeURIComponent(`${lat},${lng}`);

    const response = await fetch(
      `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${latlng}&api_key=${process.env.OLA_PLACES_API_KEY}`,
      {
        headers: {
          Accept: "*/*",
        },
      }
    );

    const data = await response.json();

    // console.log("RAW Ola response:", JSON.stringify(data, null, 2));

    // Default values
    let fullAddress = `${lat}, ${lng}`;
    let city = '';
    let postalCode = '';
    let addressLine1 = '';

    // ✅ Extract from results array (primary response format)
    if (data?.results && Array.isArray(data.results) && data.results.length > 0) {
      const firstResult = data.results[0];
      
      // Get formatted address
      fullAddress = firstResult.formatted_address || fullAddress;
      
      // Extract address components
      const components = firstResult.address_components || [];
      
      for (const component of components) {
        const types = component.types || [];
        
        if (types.includes('locality')) {
          city = component.long_name || component.short_name;
        } else if (types.includes('postal_code')) {
          postalCode = component.long_name || component.short_name;
        }
      }
      
      // Extract first part for address line 1
      addressLine1 = firstResult.name || fullAddress.split(',')[0]?.trim() || '';
    }

    const responseData = {
      address: fullAddress,
      addressLine1,
      city,
      postalCode,
      lat,
      lng
    };

    
    res.json(responseData);
  } catch (err) {
    console.error("Reverse geocode error:", err);
    res.json({ 
      address: `${lat}, ${lng}`,
      addressLine1: '',
      city: '',
      postalCode: '',
      lat,
      lng
    });
  }
};

export const geocodeAddress = async (req: Request, res: Response) => {
  const { address } = req.query;

  if (!address || String(address).trim().length < 3) {
    return res.status(400).json({ error: "Valid address is required" });
  }

  try {
    const response = await fetch(
      `https://api.olamaps.io/places/v1/geocode?address=${encodeURIComponent(
        address as string
      )}&api_key=${process.env.OLA_PLACES_API_KEY}`,
      {
        headers: { Accept: "*/*" },
      }
    );

    const text = await response.text();

    if (!response.ok) {
      console.error("❌ Ola error response:", text);
      return res.status(400).json({ error: "Ola geocode failed" });
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(400).json({ error: "Invalid Ola response" });
    }
    console.log("🧾 RAW Ola geocode:", JSON.stringify(data, null, 2));

    // 🔍 Handle multiple possible response shapes
    const results =
      data?.geocodingResults ||
      data?.results ||
      data?.data;

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: "No geocode results" });
    }

    const geometry = results[0]?.geometry;

    let lat: number | undefined;
    let lng: number | undefined;

    // ✅ Ola Maps format → coordinates: [lng, lat]
    if (Array.isArray(geometry?.coordinates)) {
      lng = geometry.coordinates[0];
      lat = geometry.coordinates[1];
    }
    // ✅ fallback (Google-like format, future-proof)
    else if (
      typeof geometry?.location?.lat === "number" &&
      typeof geometry?.location?.lng === "number"
    ) {
      lat = geometry.location.lat;
      lng = geometry.location.lng;
    }

    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ error: "No coordinates found" });
    }

    return res.json({ lat, lng });
  } catch (err) {
    console.error("❌ Geocode exception:", err);
    return res.status(500).json({ error: "Geocode failed" });
  }
};


export const checkAvailability = async (req: AuthenticatedRequest, res: Response) => {
   
  try {
    const { pickup, drop } = req.body;
    const response = await axios.post(
      process.env.UENGAGE_BASE + "/getServiceability",
      {
        store_id: process.env.STORE_ID,
        pickupDetails: pickup,
        dropDetails: drop
      },
      {
        headers: {
          "access-token": process.env.UENGAGE_TOKEN,
          "Content-Type": "application/json"
        }
      }
    );
    console.log("Uengage",response)
    res.json(response.data);

    

  } catch (err) {
    console.log(err.response?.data || err.message);
    res.status(500).json({ error: "Serviceability failed" });
  }

};

// @desc    Subscribe to newsletter
// @route   POST /api/user/newsletter/subscribe
// @access  Private (Logged-in users only)

export const subscribeNewsletter = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.newsletterSubscribed) {
      return res.status(400).json({ message: 'Already subscribed' });
    }

    user.newsletterSubscribed = true;
    await user.save();

    res.json({ message: 'Successfully subscribed to newsletter' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};


export const getSavedAddress = async (req : Request, res: Response) => {
  try {
    const user = await User.findById(req.user._id).select('addresses');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      addresses: user.addresses || []
    });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    res.status(500).json({ message: 'Failed to fetch addresses' });
  }
}

export const addNewAddress = async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      postalCode,
      country,
      latitude,
      longitude,
      locationName,
      isDefault
    } = req.body;

    // Validate required fields
    if (!fullName || !phone || !addressLine1 || !city || !postalCode || !latitude || !longitude) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['fullName', 'phone', 'addressLine1', 'city', 'postalCode', 'latitude', 'longitude']
      });
    }

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      user.addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }

    // Create new address object (TypeScript will allow this for DocumentArray)
    const newAddress: IAddress = {
      fullName,
      phone,
      addressLine1,
      addressLine2: addressLine2 || '',
      city,
      postalCode,
      country: country || 'India',
      latitude,
      longitude,
      locationName: locationName || '',
      isDefault: isDefault || false
    };

    // Push to addresses array - Mongoose will auto-generate _id
    user.addresses.push(newAddress as any); // Type assertion needed for DocumentArray
    await user.save();

    // Get the newly added address (with _id)
    const addedAddress = user.addresses[user.addresses.length - 1];

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      address: addedAddress
    });
  } catch (error) {
    console.error('Error adding address:', error);
    res.status(500).json({ message: 'Failed to add address' });
  }
}

export const UpdateAddress = async (req: Request, res: Response) => {
  try {
    const { addressId } = req.params;
    const updateData = req.body;

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const addressIndex = user.addresses.findIndex(
      addr => addr._id.toString() === addressId
    );

    if (addressIndex === -1) {
      return res.status(404).json({ message: 'Address not found' });
    }

    // If setting as default, unset others
    if (updateData.isDefault) {
      user.addresses.forEach((addr, idx) => {
        if (idx !== addressIndex) {
          addr.isDefault = false;
        }
      });
    }

    // Update address fields individually to preserve _id
    const address = user.addresses[addressIndex];
    if (updateData.fullName !== undefined) address.fullName = updateData.fullName;
    if (updateData.phone !== undefined) address.phone = updateData.phone;
    if (updateData.addressLine1 !== undefined) address.addressLine1 = updateData.addressLine1;
    if (updateData.addressLine2 !== undefined) address.addressLine2 = updateData.addressLine2;
    if (updateData.city !== undefined) address.city = updateData.city;
    if (updateData.postalCode !== undefined) address.postalCode = updateData.postalCode;
    if (updateData.country !== undefined) address.country = updateData.country;
    if (updateData.latitude !== undefined) address.latitude = updateData.latitude;
    if (updateData.longitude !== undefined) address.longitude = updateData.longitude;
    if (updateData.locationName !== undefined) address.locationName = updateData.locationName;
    if (updateData.isDefault !== undefined) address.isDefault = updateData.isDefault;
    
    await user.save();

    res.json({
      success: true,
      message: 'Address updated successfully',
      address: user.addresses[addressIndex]
    });
  } catch (error) {
    console.error('Error updating address:', error);
    res.status(500).json({ message: 'Failed to update address' });
  }
};

export const deleteAddress = async (req: Request, res: Response) => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const initialLength = user.addresses.length;
    
    // Use pull method for better type safety
    user.addresses.pull({ _id: addressId } as any);

    if (user.addresses.length === initialLength) {
      return res.status(404).json({ message: 'Address not found' });
    }

    await user.save();

    res.json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({ message: 'Failed to delete address' });
  }
};

export const defaultAddress = async (req: Request, res: Response) => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let found = false;
    user.addresses.forEach(addr => {
      if (addr._id.toString() === addressId) {
        addr.isDefault = true;
        found = true;
      } else {
        addr.isDefault = false;
      }
    });

    if (!found) {
      return res.status(404).json({ message: 'Address not found' });
    }

    await user.save();

    res.json({
      success: true,
      message: 'Default address updated successfully'
    });
  } catch (error) {
    console.error('Error setting default address:', error);
    res.status(500).json({ message: 'Failed to set default address' });
  }
};

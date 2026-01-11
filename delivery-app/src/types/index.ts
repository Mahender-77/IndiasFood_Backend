export interface Address {
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface DeliveryUser {
  _id: string;
  username: string;
  email: string;
  role: 'delivery';
  token?: string; // Token is stored in AuthContext, but useful here for initial login response
}

export interface OrderItem {
  name: string;
  qty: number;
  image: string;
  price: number;
  product: string;
}

export interface Order {
  _id: string;
  user: string | DeliveryUser | { username: string; email: string }; // User can be populated or just basic info
  orderItems: OrderItem[];
  shippingAddress: Address;
  paymentMethod: string;
  paymentResult?: {
    id?: string;
    status?: string;
    update_time?: string;
    email_address?: string;
  };
  taxPrice: number;
  shippingPrice: number;
  totalPrice: number;
  isPaid: boolean;
  paidAt?: string;
  isDelivered: boolean;
  deliveredAt?: string;
  deliveryPerson?: string | DeliveryUser; // Delivery person can be populated or just ID
  eta?: string;
  createdAt: string;
  updatedAt: string;
}


import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Order, OrderItem } from '@/types';
import { ArrowLeft, PackageCheck } from 'lucide-react';

const getOrderStatus = (order: Order) => {
  if (order.isDelivered) return 'delivered';
  if (order.isPaid) return 'confirmed';
  return 'placed';
};

const statusConfig = {
  placed: {
    label: 'Order Placed',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
  },
  confirmed: {
    label: 'Confirmed',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  delivered: {
    label: 'Delivered',
    color: 'text-pistachio',
    bgColor: 'bg-green-100',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
};

const DeliveryOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/admin/orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrder(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch order details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id, token]);

  const handleMarkDelivered = async () => {
    if (!token || !id) return;
    try {
      await api.put(`/admin/orders/${id}/status`, { status: 'delivered' }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchOrder(); // Refresh order details
    } catch (err: any) {
      console.error('Failed to update order status', err);
      setError(err.response?.data?.message || 'Failed to mark order as delivered');
    }
  };

  if (loading) {
    return (
      <Layout>
        <section className="section-padding bg-cream min-h-[calc(100vh-200px)]">
          <div className="container-custom">
            <p>Loading order details...</p>
          </div>
        </section>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <section className="section-padding bg-cream min-h-[calc(100vh-200px)]">
          <div className="container-custom">
            <p className="text-red-500">Error: {error}</p>
            <Link to="/dashboard">
              <Button variant="outline" className="mt-4">Back to Dashboard</Button>
            </Link>
          </div>
        </section>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout>
        <section className="section-padding bg-cream min-h-[calc(100vh-200px)]">
          <div className="container-custom">
            <p>Order not found.</p>
            <Link to="/dashboard">
              <Button variant="outline" className="mt-4">Back to Dashboard</Button>
            </Link>
          </div>
        </section>
      </Layout>
    );
  }

  const currentStatus = getOrderStatus(order);
  const status = statusConfig[currentStatus as keyof typeof statusConfig];

  return (
    <Layout>
      <div className="bg-muted/50 py-4">
        <div className="container-custom">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      <section className="section-padding bg-background">
        <div className="container-custom">
          <h1 className="font-display text-3xl font-bold mb-6">Order Details: {order._id}</h1>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Order Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p><strong>Status:</strong> <Badge className={`${status.bgColor} ${status.color}`}>{status.label}</Badge></p>
                <p><strong>Total Price:</strong> ₹{order.totalPrice}</p>
                <p><strong>Payment:</strong> {order.isPaid ? 'Paid' : 'Not Paid'} {order.paidAt && `on ${new Date(order.paidAt).toLocaleDateString()}`}</p>
                <p><strong>Delivery:</strong> {order.isDelivered ? 'Delivered' : 'Pending'} {order.deliveredAt && `on ${new Date(order.deliveredAt).toLocaleDateString()}`}</p>
                {order.eta && <p><strong>ETA:</strong> {order.eta}</p>}
                {order.deliveryPerson && typeof order.deliveryPerson !== 'string' && (
                  <p><strong>Delivery Person:</strong> {order.deliveryPerson.username} ({order.deliveryPerson.email})</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Shipping Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p>{order.shippingAddress.address}</p>
                <p>{order.shippingAddress.city}, {order.shippingAddress.postalCode}</p>
                <p>{order.shippingAddress.country}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {typeof order.user !== 'string' && (
                  <p><strong>Name:</strong> {order.user.username}</p>
                )}
                {typeof order.user !== 'string' && (
                  <p><strong>Email:</strong> {order.user.email}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <h2 className="font-display text-2xl font-bold mb-4">Order Items</h2>
          {order.orderItems.length > 0 ? (
            <div className="rounded-md border">
              <table className="min-w-full divide-y divide-gray-200">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.orderItems.map((item: OrderItem) => (
                    <TableRow key={item.product}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.qty}</TableCell>
                      <TableCell>₹{item.price}</TableCell>
                      <TableCell>₹{(item.qty * item.price).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground">No items in this order.</p>
          )}

          {!order.isDelivered && (
            <div className="mt-8 text-right">
              <Button onClick={handleMarkDelivered} className="gap-2">
                <PackageCheck className="h-4 w-4" /> Mark as Delivered
              </Button>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default DeliveryOrderDetail;


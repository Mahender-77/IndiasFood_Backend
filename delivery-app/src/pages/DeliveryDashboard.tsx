import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Order } from '@/types';
import { Truck, Package, PackageCheck, ListOrdered } from 'lucide-react';

interface OrderExtended extends Order {
  user: { username: string; email: string };
}

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

const DeliveryDashboard = () => {
  const { user, token } = useAuth();
  const [assignedOrders, setAssignedOrders] = useState<OrderExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignedOrders = async () => {
    if (!user || !token) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/admin/orders?deliveryPersonId=${user._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Filter orders to show only those assigned to the current delivery person
      setAssignedOrders(data.filter((order: OrderExtended) => (order.deliveryPerson as any)?._id === user._id));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch assigned orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedOrders();
  }, [user, token]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    if (!token) return;
    try {
      await api.put(`/admin/orders/${orderId}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAssignedOrders(); // Refresh orders after update
    } catch (err: any) {
      console.error('Failed to update order status', err);
      setError(err.response?.data?.message || 'Failed to update order status');
    }
  };

  if (loading) {
    return (
      <Layout>
        <section className="section-padding bg-cream min-h-[calc(100vh-200px)]">
          <div className="container-custom">
            <p>Loading assigned orders...</p>
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
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="section-padding bg-cream min-h-[calc(100vh-200px)]">
        <div className="container-custom">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-8">
            Delivery Dashboard
          </h1>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Assigned Deliveries</CardTitle>
                <Truck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{assignedOrders.length}</p>
                <p className="text-xs text-muted-foreground">
                  Orders assigned to you
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Deliveries</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{assignedOrders.filter(order => !order.isDelivered).length}</p>
                <p className="text-xs text-muted-foreground">
                  Orders yet to be delivered
                </p>
              </CardContent>
            </Card>
          </div>

          <h2 className="font-display text-2xl font-bold text-foreground mb-6">My Deliveries</h2>

          {assignedOrders.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ORDER ID</TableHead>
                    <TableHead>CUSTOMER</TableHead>
                    <TableHead>ADDRESS</TableHead>
                    <TableHead>ETA</TableHead>
                    <TableHead>STATUS</TableHead>
                    <TableHead>ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedOrders.map((order) => {
                    const currentStatus = getOrderStatus(order);
                    const status = statusConfig[currentStatus as keyof typeof statusConfig];
                    return (
                      <TableRow key={order._id}>
                        <TableCell className="font-medium">
                          <Link to={`/orders/${order._id}`} className="text-blue-600 hover:underline">
                            {order._id}
                          </Link>
                        </TableCell>
                        <TableCell>{order.user.username}</TableCell>
                        <TableCell>{order.shippingAddress.address}, {order.shippingAddress.city}</TableCell>
                        <TableCell>{order.eta || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge className={`${status.bgColor} ${status.color}`}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {!order.isDelivered && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateOrderStatus(order._id, 'delivered')}
                              className="mr-2"
                            >
                              <PackageCheck className="h-4 w-4 mr-1" /> Mark Delivered
                            </Button>
                          )}
                          <Link to={`/orders/${order._id}`}>
                            <Button variant="secondary" size="sm">
                              <ListOrdered className="h-4 w-4 mr-1" /> View Details
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground">No orders currently assigned for delivery.</p>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default DeliveryDashboard;


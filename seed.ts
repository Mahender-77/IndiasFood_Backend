import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product';
import User from './models/User';
import Category from './models/Category';
import Order from './models/Order'; // Import Order model
import connectDB from './utils/db';
import bcrypt from 'bcryptjs'; // Import bcrypt for hashing passwords

dotenv.config();
connectDB();

const categoriesData = [
  { name: 'Sweets', isActive: true },
  { name: 'Namkeen', isActive: true },
  { name: 'Podi', isActive: true },
];

const productsData = [
  {
    name: 'Gulab Jamun',
    images: ['/assets/gulab-jamun.jpg'],
    description: 'Soft, melt-in-your-mouth fried dumplings soaked in rose-flavored sugar syrup.',
    category: '',
    price: 150,
    countInStock: 50,
  },
  {
    name: 'Kaju Katli',
    images: ['/assets/kaju-katli.jpg'],
    description: 'A delicious, diamond-shaped sweet made from cashew nuts and sugar.',
    category: '',
    price: 300,
    countInStock: 40,
  },
  {
    name: 'Motichoor Ladoo',
    images: ['/assets/motichoor-ladoo.jpg'],
    description: 'Tiny, spherical sweets made from gram flour, fried in ghee and soaked in sugar syrup.',
    category: '',
    price: 180,
    countInStock: 60,
  },
  {
    name: 'Badam Halwa',
    images: ['/assets/badam-halwa.jpg'],
    description: 'A rich and creamy dessert made from almonds, ghee, sugar, and saffron.',
    category: '',
    price: 250,
    countInStock: 30,
  },
  {
    name: 'Mysore Pak',
    images: ['/assets/mysore-pak.jpg'],
    description: 'A dense sweet confection prepared in ghee, sugar, gram flour, and cardamom.',
    category: '',
    price: 220,
    countInStock: 45,
  },
  {
    name: 'Pista Barfi',
    images: ['/assets/pista-barfi.jpg'],
    description: 'A delightful green-colored sweet made from pistachios and milk solids.',
    category: '',
    price: 280,
    countInStock: 35,
  },
  {
    name: 'Soan Papdi',
    images: ['/assets/soan-papdi.jpg'],
    description: 'A flaky, cuboid-shaped sweet that is crisp and melts in your mouth.',
    category: '',
    price: 120,
    countInStock: 70,
  },
  {
    name: 'Rasgulla',
    images: ['/assets/placeholder.svg'],
    description: 'Spongy, syrupy cheese balls made from chhena (Indian cottage cheese).',
    category: '',
    price: 160,
    countInStock: 55,
  },
  {
    name: 'Jalebi',
    images: ['/assets/placeholder.svg'],
    description: 'Crispy, juicy, pretzel-like sweets made from fermented batter and soaked in sugar syrup.',
    category: '',
    price: 100,
    countInStock: 80,
  },
  {
    name: 'Rasmalai',
    images: ['/assets/placeholder.svg'],
    description: 'Soft, spongy cottage cheese dumplings soaked in sweetened, flavored milk.',
    category: '',
    price: 200,
    countInStock: 40,
  },
];

const adminUsersData = [
  {
    username: 'admin1',
    email: 'admin1@example.com',
    password: 'password123',
    addresses: [{ address: '101 Admin Street', city: 'Pune', postalCode: '411001', country: 'India' }],
    role: 'admin',
    isAdmin: true,
  },
  {
    username: 'admin2',
    email: 'admin2@example.com',
    password: 'password123',
    addresses: [{ address: '102 Admin Avenue', city: 'Pune', postalCode: '411002', country: 'India' }],
    role: 'admin',
    isAdmin: true,
  },
];

const customerUsersData = [
  {
    username: 'customer1',
    email: 'customer1@example.com',
    password: 'password123',
    addresses: [{ address: '201 Customer Lane', city: 'Pune', postalCode: '411003', country: 'India' }],
    role: 'user',
  },
  {
    username: 'customer2',
    email: 'customer2@example.com',
    password: 'password123',
    addresses: [{ address: '202 Customer Road', city: 'Pune', postalCode: '411004', country: 'India' }],
    role: 'user',
  },
  {
    username: 'customer3',
    email: 'customer3@example.com',
    password: 'password123',
    addresses: [{ address: '203 Customer Path', city: 'Pune', postalCode: '411005', country: 'India' }],
    role: 'user',
  },
  {
    username: 'customer4',
    email: 'customer4@example.com',
    password: 'password123',
    addresses: [{ address: '204 Customer Way', city: 'Pune', postalCode: '411006', country: 'India' }],
    role: 'user',
  },
  {
    username: 'customer5',
    email: 'customer5@example.com',
    password: 'password123',
    addresses: [{ address: '205 Customer Boulevard', city: 'Pune', postalCode: '411007', country: 'India' }],
    role: 'user',
  },
];

const deliveryPersonsData = [
  {
    username: 'delivery1',
    email: 'delivery1@example.com',
    password: 'password123',
    addresses: [{ address: '123 Delivery St', city: 'Pune', postalCode: '411001', country: 'India' }],
    role: 'delivery',
  },
  {
    username: 'delivery2',
    email: 'delivery2@example.com',
    password: 'password123',
    addresses: [{ address: '456 Express Rd', city: 'Pune', postalCode: '411002', country: 'India' }],
    role: 'delivery',
  },
  {
    username: 'delivery3',
    email: 'delivery3@example.com',
    password: 'password123',
    addresses: [{ address: '789 Fast Lane', city: 'Pune', postalCode: '411003', country: 'India' }],
    role: 'delivery',
  },
];

const importData = async () => {
  try {
    await Product.deleteMany({});
    await User.deleteMany({}); // Clear all users
    await Order.deleteMany({});
    await Category.deleteMany({});

    // Create Categories
    const createdCategories = await Category.insertMany(categoriesData);
    const sweetCategory = createdCategories.find(cat => cat.name === 'Sweets');
    if (!sweetCategory) {
      console.error('Sweets category not found after seeding!');
      process.exit(1);
    }

    // Create Products with category ID
    const productsWithCategory = productsData.map(product => ({
      ...product,
      category: sweetCategory._id,
    }));
    const createdProducts = await Product.insertMany(productsWithCategory);

    // Hash passwords for all user types and insert
    const allUsersData = [...adminUsersData, ...customerUsersData, ...deliveryPersonsData];
    const hashedUsers = await Promise.all(allUsersData.map(async (user) => {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(user.password, salt);
      return { ...user, password: hashedPassword };
    }));
    const createdUsers = await User.insertMany(hashedUsers);

    // Find specific users for orders
    const customer1 = createdUsers.find(u => u.email === 'customer1@example.com');
    const customer2 = createdUsers.find(u => u.email === 'customer2@example.com');
    const adminUser = createdUsers.find(u => u.email === 'admin1@example.com');
    const deliveryGuy1 = createdUsers.find(u => u.email === 'delivery1@example.com');

    const gulabJamun = createdProducts.find(p => p.name === 'Gulab Jamun');
    const kajuKatli = createdProducts.find(p => p.name === 'Kaju Katli');
    const motichoorLadoo = createdProducts.find(p => p.name === 'Motichoor Ladoo');

    // Create Sample Orders
    const ordersData = [];

    if (customer1 && gulabJamun) {
      ordersData.push({
        user: customer1._id,
        orderItems: [{ name: gulabJamun.name, qty: 2, image: gulabJamun.images[0], price: gulabJamun.price, product: gulabJamun._id }],
        shippingAddress: customer1.addresses[0],
        paymentMethod: 'Credit Card',
        taxPrice: 10,
        shippingPrice: 50,
        totalPrice: gulabJamun.price * 2 + 10 + 50,
        isPaid: true,
        paidAt: new Date(),
        isDelivered: false,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      });
    }

    if (customer2 && kajuKatli && motichoorLadoo) {
      ordersData.push({
        user: customer2._id,
        orderItems: [
          { name: kajuKatli.name, qty: 1, image: kajuKatli.images[0], price: kajuKatli.price, product: kajuKatli._id },
          { name: motichoorLadoo.name, qty: 3, image: motichoorLadoo.images[0], price: motichoorLadoo.price, product: motichoorLadoo._id },
        ],
        shippingAddress: customer2.addresses[0],
        paymentMethod: 'PayPal',
        taxPrice: 25,
        shippingPrice: 60,
        totalPrice: kajuKatli.price * 1 + motichoorLadoo.price * 3 + 25 + 60,
        isPaid: true,
        paidAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        isDelivered: true,
        deliveredAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        deliveryPerson: deliveryGuy1?._id,
        eta: 'Delivered',
      });
    }

    // Add more sample orders as needed
    if (customer1 && kajuKatli) {
      ordersData.push({
        user: customer1._id,
        orderItems: [{ name: kajuKatli.name, qty: 1, image: kajuKatli.images[0], price: kajuKatli.price, product: kajuKatli._id }],
        shippingAddress: customer1.addresses[0],
        paymentMethod: 'Credit Card',
        taxPrice: 15,
        shippingPrice: 40,
        totalPrice: kajuKatli.price * 1 + 15 + 40,
        isPaid: true,
        paidAt: new Date(),
        isDelivered: false,
      });
    }

    if (customer2 && gulabJamun) {
      ordersData.push({
        user: customer2._id,
        orderItems: [{ name: gulabJamun.name, qty: 3, image: gulabJamun.images[0], price: gulabJamun.price, product: gulabJamun._id }],
        shippingAddress: customer2.addresses[0],
        paymentMethod: 'Cash On Delivery',
        taxPrice: 20,
        shippingPrice: 50,
        totalPrice: gulabJamun.price * 3 + 20 + 50,
        isPaid: false,
        isDelivered: false,
      });
    }

    if (adminUser && motichoorLadoo) {
      ordersData.push({
        user: adminUser._id,
        orderItems: [{ name: motichoorLadoo.name, qty: 5, image: motichoorLadoo.images[0], price: motichoorLadoo.price, product: motichoorLadoo._id }],
        shippingAddress: adminUser.addresses[0],
        paymentMethod: 'Credit Card',
        taxPrice: 30,
        shippingPrice: 70,
        totalPrice: motichoorLadoo.price * 5 + 30 + 70,
        isPaid: true,
        paidAt: new Date(),
        isDelivered: false,
      });
    }

    await Order.insertMany(ordersData);

    console.log('Data Imported!');
    process.exit();
  } catch (error) {
    console.error(`${error}`);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await Product.deleteMany({});
    await User.deleteMany({}); // Clear all users
    await Order.deleteMany({});
    await Category.deleteMany({});
    console.log('Data Destroyed!');
    process.exit();
  } catch (error) {
    console.error(`${error}`);
    process.exit(1);
  }
};

if (process.argv[2] === '-d') {
  destroyData();
} else {
  importData();
}

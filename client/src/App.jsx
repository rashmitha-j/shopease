import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import AuthProvider from './context/AuthProvider.jsx';
import CartProvider from './context/CartProvider.jsx';
import Layout from './components/layout/Layout.jsx';
import HomePage from './pages/HomePage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import ProductDetailPage from './pages/ProductDetailPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import CartPage from './pages/CartPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import OrderDetailPage from './pages/OrderDetailPage.jsx';
import RequireAuth from './components/auth/RequireAuth.jsx';
import RequireAdmin from './components/auth/RequireAdmin.jsx';
import AdminLayout from './components/admin/AdminLayout.jsx';
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx';
import AdminSectionPage from './pages/admin/AdminSectionPage.jsx';
import AdminProductsPage from './pages/admin/AdminProductsPage.jsx';
import AdminOrdersPage from './pages/admin/AdminOrdersPage.jsx';
import AdminOrderDetailPage from './pages/admin/AdminOrderDetailPage.jsx';
import { AdminEditProductPage, AdminNewProductPage } from './pages/admin/AdminProductFormPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: HomePage },
      // Search, category and page live in the URL: /products?q=&category=&page=
      { path: 'products', Component: ProductsPage },
      { path: 'products/:slug', Component: ProductDetailPage },
      { path: 'login', Component: LoginPage },
      { path: 'register', Component: RegisterPage },
      { path: 'cart', Component: CartPage },
      // Pages below need a logged-in user; visitors are sent to /login and brought back
      {
        Component: RequireAuth,
        children: [
          { path: 'checkout', Component: CheckoutPage },
          { path: 'orders', Component: OrdersPage },
          { path: 'orders/:id', Component: OrderDetailPage },
        ],
      },
      // Admin area: login + admin role required (the API enforces the same rule)
      {
        path: 'admin',
        Component: RequireAdmin,
        children: [
          {
            Component: AdminLayout,
            children: [
              { index: true, Component: AdminDashboardPage },
              { path: 'products', Component: AdminProductsPage },
              { path: 'products/new', Component: AdminNewProductPage },
              { path: 'products/:slug/edit', Component: AdminEditProductPage },
              { path: 'orders', Component: AdminOrdersPage },
              { path: 'orders/:id', Component: AdminOrderDetailPage },
              {
                path: 'reviews',
                element: (
                  <AdminSectionPage
                    title="Reviews"
                    description="Customer reviews haven’t been built yet, so there is nothing to moderate."
                  />
                ),
              },
            ],
          },
        ],
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </AuthProvider>
  );
}

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProfileProvider } from "./context/AuthProfileContext";
import { BuyerOrdersProvider } from "./context/BuyerOrdersContext";
import { CartProvider } from "./context/CartContext";
import { RequireAuth, RequireProfile } from "./components/ProtectedRoute";
import LoginPage from "./pages/Auth/LoginPage";
import OnboardingPage from "./pages/Onboarding/OnboardingPage";
import ShopsPage from "./pages/Shops/ShopsPage";
import ShopDetailsPage from "./pages/ShopDetails/ShopDetailsPage";
import CartPage from "./pages/Cart/CartPage";
import OrdersPage from "./pages/Orders/OrdersPage";
import ProfilePage from "./pages/Profile/ProfilePage";
import PublicHomePage from "./pages/Public/PublicHomePage";
import PublicShopPage from "./pages/Public/PublicShopPage";
import OrderThanksPage from "./pages/Public/OrderThanksPage";
import OrderTrackPage from "./pages/Public/OrderTrackPage";
import GuestDashboardPage from "./pages/Public/GuestDashboardPage";
import ExplorePage from "./pages/Home/ExplorePage";
import TrackLookupPage from "./pages/Public/TrackLookupPage";

export default function App() {
  return (
    <AuthProfileProvider>
      <BuyerOrdersProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/explore" replace />} />
              <Route path="/enter-shop" element={<PublicHomePage />} />
              <Route path="/shop/:code" element={<PublicShopPage />} />
              <Route path="/s/:slug" element={<PublicShopPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/order/thanks" element={<OrderThanksPage />} />
              <Route path="/order-success" element={<Navigate to="/order/thanks" replace />} />
              <Route path="/order/:orderId/track" element={<OrderTrackPage />} />
              <Route path="/dashboard" element={<GuestDashboardPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/track" element={<TrackLookupPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route element={<RequireAuth />}>
                <Route path="onboarding" element={<OnboardingPage />} />
              </Route>
              <Route element={<RequireProfile />}>
                <Route path="shops" element={<ShopsPage />} />
                <Route path="shops/:sellerId" element={<ShopDetailsPage />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>
              <Route path="*" element={<Navigate to="/explore" replace />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </BuyerOrdersProvider>
    </AuthProfileProvider>
  );
}

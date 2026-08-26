import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { AuthProvider } from "./lib/auth-context";
import { ThemeProvider } from "./lib/theme-context";
import { ToastProvider } from "./components/ui/Toast";
import Login from "./pages/Login";
import CustomerList from "./pages/CustomerList";
import CustomerDetails from "./pages/CustomerDetails";
import CallList from "./pages/CallList";
import CallDetails from "./pages/CallDetails";
import MissedCalls from "./pages/MissedCalls";
import FollowUps from "./pages/FollowUps";
import Reports from "./pages/Reports";
import Export from "./pages/Export";
import Import from "./pages/Import";
import Employees from "./pages/Employees";
import Products from "./pages/Products";
import BusinessNumbers from "./pages/BusinessNumbers";
import CustomerTracker from "./pages/CustomerTracker";
import StockOverview from "./pages/StockOverview";
import StockItems from "./pages/StockItems";
import StockItemsByLocation from "./pages/StockItemsByLocation";
import StockMovements from "./pages/StockMovements";
import TeamCoverage from "./pages/TeamCoverage";
import Team from "./pages/Team";
import SetPassword from "./pages/SetPassword";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/set-password" element={<SetPassword />} />
              <Route element={<AppShell />}>
                <Route path="/customers" element={<CustomerList />} />
                <Route path="/customers/:id" element={<CustomerDetails />} />
                <Route path="/calls" element={<CallList />} />
                <Route path="/calls/:id" element={<CallDetails />} />
                <Route path="/missed-calls" element={<MissedCalls />} />
                <Route path="/follow-ups" element={<FollowUps />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/export" element={<Export />} />
                <Route path="/import" element={<Import />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/team" element={<Team />} />
                <Route path="/products" element={<Products />} />
                <Route path="/business-numbers" element={<BusinessNumbers />} />
                <Route path="/team-coverage" element={<TeamCoverage />} />
                <Route path="/customer-tracker" element={<CustomerTracker />} />
                <Route path="/stock" element={<StockOverview />} />
                <Route path="/stock/items" element={<StockItems />} />
                <Route path="/stock/items/:location" element={<StockItemsByLocation />} />
                <Route path="/stock/movements" element={<StockMovements />} />
              </Route>
              <Route path="/" element={<Navigate to="/customers" replace />} />
              <Route path="*" element={<Navigate to="/customers" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { AuthProvider } from "./lib/auth-context";
import { ThemeProvider } from "./lib/theme-context";
import { ToastProvider } from "./components/ui/Toast";
import Login from "./pages/Login";
import CustomerList from "./pages/CustomerList";
import CallList from "./pages/CallList";
import CallDetails from "./pages/CallDetails";
import FollowUps from "./pages/FollowUps";
import Reports from "./pages/Reports";
import Export from "./pages/Export";
import Import from "./pages/Import";
import Employees from "./pages/Employees";
import Products from "./pages/Products";
import BusinessNumbers from "./pages/BusinessNumbers";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<AppShell />}>
                <Route path="/customers" element={<CustomerList />} />
                <Route path="/calls" element={<CallList />} />
                <Route path="/calls/:id" element={<CallDetails />} />
                <Route path="/follow-ups" element={<FollowUps />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/export" element={<Export />} />
                <Route path="/import" element={<Import />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/products" element={<Products />} />
                <Route path="/business-numbers" element={<BusinessNumbers />} />
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

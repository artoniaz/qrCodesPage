import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProductPage from "./components/ProductPage";
import HomePage from "./components/HomePage";
import useBarcodeScanner from "./hooks/useBarcodeScanner";
import "./App.css";

// Sits inside the router so the global scan listener can use useNavigate.
function ScannerListener() {
  useBarcodeScanner();
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ScannerListener />
      <Routes>
        <Route path="/product/front/:id" element={<ProductPage />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

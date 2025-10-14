import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProductPage from './components/ProductPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/" element={
          <div style={{
            minHeight: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            textAlign: 'center',
            padding: '2rem'
          }}>
            <div>
              <h1>AZM Products</h1>
              <p>Use a product URL like: /product/rec2hkOvAAFTTVVTd</p>
            </div>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

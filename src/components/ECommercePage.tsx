import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag,
  ArrowLeft,
  Search,
  Filter,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  History,
  Wallet,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Package,
  AlertCircle,
  X,
  CheckCircle2
} from 'lucide-react';
import { db, createAuditLog } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { UserProfile, Wallet as WalletType } from '../types';
import { useCCSettings } from '../context/CCSettingsContext';
import ChosenLogo from './ChosenLogo';

// Matching inventory items structure
interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  priceCC: number;
  phpPrice: number;
  stock: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

interface CartItem {
  product: InventoryItem;
  quantity: number;
}

interface ECommercePageProps {
  userProfile: UserProfile;
  onLogout: () => void;
  onNavigate: (page: string) => void;
}

const CATEGORIES = [
  'All Products',
  'Herbal Wellness Beverage',
  'Functional Coffee Beverage',
  'Barley Grass Beverage',
  'Chocolate Wellness Beverage',
  'Ready-to-Mix Coffee Beverage'
];

// Helper to get emojis based on product ID or category
const getProductEmoji = (id: string, name: string): string => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('herbal')) return '🌿';
  if (nameLower.includes('coffee') || nameLower.includes('latte')) return '☕';
  if (nameLower.includes('barley')) return '🌾';
  if (nameLower.includes('choco')) return '🍫';
  if (nameLower.includes('caramel')) return '🧊';
  return '📦';
};

// Helper to get product description
const getProductDescription = (name: string): string => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('herbal')) {
    return 'A concentrated herbal beverage formulated to support daily wellness and healthy living.';
  }
  if (nameLower.includes('latte')) {
    return 'A premium coffee blend combining rich flavor with carefully selected herbal extracts.';
  }
  if (nameLower.includes('pure barley')) {
    return 'A barley grass beverage designed to complement a balanced diet and active lifestyle.';
  }
  if (nameLower.includes('caramel')) {
    return 'A refreshing iced coffee blend with a smooth, premium salted caramel flavor.';
  }
  if (nameLower.includes('choco')) {
    return 'A delicious cocoa and barley mix that provides nutrition and sustained natural energy.';
  }
  return 'A high-quality wellness item crafted to elevate your daily lifestyle.';
};

export default function ECommercePage({ userProfile, onLogout, onNavigate }: ECommercePageProps) {
  const { ccSettings } = useCCSettings();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  
  // UI states
  const [activeTab, setActiveTab] = useState<'shop' | 'orders'>('shop');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Products');
  const [sortBy, setSortBy] = useState<'name' | 'price-asc' | 'price-desc' | 'stock'>('name');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  // Modal states
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);

  // Load live data from Firestore
  useEffect(() => {
    fetchMarketplaceData();
  }, [userProfile.uid]);

  const fetchMarketplaceData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch live wallet balance
      const walletRef = doc(db, 'wallets', userProfile.uid);
      const walletSnap = await getDoc(walletRef);
      if (walletSnap.exists()) {
        setWallet(walletSnap.data() as WalletType);
      }

      // 2. Fetch inventory items from system/inventory
      const inventoryDocRef = doc(db, 'system', 'inventory');
      const inventorySnap = await getDoc(inventoryDocRef);
      let productList: InventoryItem[] = [];

      const defaultInventory: InventoryItem[] = [
        {
          id: 'prod-001',
          name: 'Chosen Herbal Blend',
          sku: 'ICH-HB-001',
          category: 'Herbal Wellness Beverage',
          priceCC: 8,
          phpPrice: 560,
          stock: 1420,
          status: 'In Stock'
        },
        {
          id: 'prod-002',
          name: 'Chosen 15-in-1 Latte Coffee',
          sku: 'ICH-COF-002',
          category: 'Functional Coffee Beverage',
          priceCC: 15,
          phpPrice: 1050,
          stock: 2150,
          status: 'In Stock'
        },
        {
          id: 'prod-003',
          name: 'Chosen Pure Barley',
          sku: 'ICH-BAR-003',
          category: 'Barley Grass Beverage',
          priceCC: 16,
          phpPrice: 1120,
          stock: 980,
          status: 'In Stock'
        },
        {
          id: 'prod-004',
          name: 'Chosen Salted Caramel Iced Coffee',
          sku: 'ICH-SCC-004',
          category: 'Ready-to-Mix Coffee Beverage',
          priceCC: 16,
          phpPrice: 1120,
          stock: 1120,
          status: 'In Stock'
        },
        {
          id: 'prod-005',
          name: 'Chosen Choco Barley',
          sku: 'ICH-CHO-005',
          category: 'Chocolate Wellness Beverage',
          priceCC: 16,
          phpPrice: 1120,
          stock: 1500,
          status: 'In Stock'
        }
      ];

      if (inventorySnap.exists()) {
        productList = inventorySnap.data().items as InventoryItem[];
      } else {
        await setDoc(inventoryDocRef, { items: defaultInventory });
        productList = defaultInventory;
      }
      setProducts(productList);

      // 3. Fetch past orders
      const ordersQuery = query(
        collection(db, 'orders'),
        where('uid', '==', userProfile.uid)
      );
      const ordersSnap = await getDocs(ordersQuery);
      const ordersList = ordersSnap.docs.map(doc => doc.data());
      ordersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(ordersList);

    } catch (err: any) {
      console.error('Error fetching marketplace:', err);
      setError('We could not load the product marketplace. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Back Navigation handler
  const handleBackNavigation = () => {
    if (userProfile.role === 'Customer') {
      onNavigate('customer-dashboard');
    } else if (userProfile.role === 'Affiliate') {
      onNavigate('affiliate-dashboard');
    } else if (userProfile.role === 'Super Admin') {
      onNavigate('super-admin-dashboard');
    } else {
      onNavigate('dashboard');
    }
  };

  // Cart operations
  const addToCart = (product: InventoryItem, quantity = 1) => {
    if (product.stock <= 0 || product.status === 'Out of Stock') {
      window.showWarning?.(`Sorry, ${product.name} is currently out of stock.`, 'Out of Stock');
      return;
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === product.id);
      if (existingItem) {
        const newQty = existingItem.quantity + quantity;
        if (newQty > product.stock) {
          window.showWarning?.(`We only have ${product.stock} units of ${product.name} left in stock.`, 'Stock Limit Reached');
          return prevCart.map(item =>
            item.product.id === product.id ? { ...item, quantity: product.stock } : item
          );
        }
        return prevCart.map(item =>
          item.product.id === product.id ? { ...item, quantity: newQty } : item
        );
      }
      return [...prevCart, { product, quantity }];
    });

    window.showSuccess?.(`${product.name} has been added to your cart.`, 'Item Added');
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > item.product.stock) {
            window.showWarning?.(`We only have ${item.product.stock} units of ${item.product.name} left.`, 'Stock Limit Reached');
            return { ...item, quantity: item.product.stock };
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.product.priceCC * item.quantity), 0);
  };

  // Direct checkout
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!wallet) {
      window.showError?.('Could not verify wallet balance. Please refresh and try again.', 'Wallet Not Found');
      return;
    }

    const totalCC = getCartTotal();

    // 1. Balance verification
    if (wallet.chosenWalletBalance < totalCC) {
      window.showError?.(
        `Insufficient Chosen Credits (CC). This purchase requires ${totalCC} CC, but you only have ${wallet.chosenWalletBalance.toFixed(2)} CC. Please top up your wallet.`,
        'Insufficient Balance'
      );
      return;
    }

    setPurchaseLoading(true);
    try {
      const batch = writeBatch(db);
      
      // Fetch fresh inventory document to verify stock levels in real time
      const inventoryDocRef = doc(db, 'system', 'inventory');
      const inventorySnap = await getDoc(inventoryDocRef);
      if (!inventorySnap.exists()) {
        throw new Error('Inventory database record could not be found.');
      }
      const currentInventory = inventorySnap.data().items as InventoryItem[];

      // Verify each item's stock
      for (const cartItem of cart) {
        const liveProduct = currentInventory.find(p => p.id === cartItem.product.id);
        if (!liveProduct) {
          throw new Error(`Product ${cartItem.product.name} could not be matched in database.`);
        }
        if (liveProduct.stock < cartItem.quantity) {
          throw new Error(`Insufficient stock for ${liveProduct.name}. Only ${liveProduct.stock} left.`);
        }
      }

      // 2. Decrement wallet balance
      const newBalance = wallet.chosenWalletBalance - totalCC;
      const walletRef = doc(db, 'wallets', userProfile.uid);
      batch.update(walletRef, {
        chosenWalletBalance: Number(newBalance.toFixed(2)),
        updatedAt: new Date().toISOString()
      });

      // 3. Record individual orders & decrement database stock
      const updatedInventory = currentInventory.map(item => {
        const cartItem = cart.find(ci => ci.product.id === item.id);
        if (cartItem) {
          const newStock = item.stock - cartItem.quantity;
          return {
            ...item,
            stock: newStock,
            status: newStock <= 0 ? 'Out of Stock' : newStock <= 10 ? 'Low Stock' : 'In Stock'
          };
        }
        return item;
      });

      batch.update(inventoryDocRef, { items: updatedInventory });

      // Create orders collection documents and transaction ledgers
      const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const txId = `TX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // 4. Create single consolidated Order
      const itemsSummary = cart.map(item => `${item.quantity}x ${item.product.name}`).join(', ');
      const orderRef = doc(db, 'orders', orderId);
      batch.set(orderRef, {
        id: orderId,
        uid: userProfile.uid,
        productName: itemsSummary,
        priceCC: totalCC,
        items: cart.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          priceCC: item.product.priceCC,
          category: item.product.category
        })),
        createdAt: new Date().toISOString()
      });

      // 5. Create Wallet Debit Transaction
      const txRef = doc(db, 'wallet_transactions', txId);
      batch.set(txRef, {
        id: txId,
        uid: userProfile.uid,
        amount: totalCC,
        type: 'DEBIT',
        walletType: 'Chosen Wallet',
        status: 'Completed',
        description: `E-Commerce order ${orderId} (${cart.length} items)`,
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      });

      await batch.commit();

      // Create Audit Log
      await createAuditLog(
        userProfile.uid,
        userProfile.email,
        'PRODUCT_PURCHASE',
        `Completed E-Commerce purchase of ${itemsSummary} for ${totalCC} CC. Order ID: ${orderId}`
      );

      // Reset cart and reload live values
      clearCart();
      setIsCartOpen(false);
      window.showSuccess?.(`Successfully purchased wellness products! Your Order ID is ${orderId}.`, 'Purchase Confirmed');
      fetchMarketplaceData();

    } catch (err: any) {
      console.error('Checkout failed:', err);
      window.showError?.(err.message || 'The checkout process failed. Please try again.', 'Purchase Failed');
    } finally {
      setPurchaseLoading(false);
    }
  };

  // Filter and sort products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All Products' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'price-asc') return a.priceCC - b.priceCC;
    if (sortBy === 'price-desc') return b.priceCC - a.priceCC;
    if (sortBy === 'stock') return b.stock - a.stock;
    return 0;
  });

  return (
    <div className="bg-[#0B0D12] text-white min-h-screen flex flex-col font-sans selection:bg-gold selection:text-black">
      
      {/* HEADER SECTION */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBackNavigation}
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-gold/30 hover:text-gold transition-all duration-300 cursor-pointer"
            aria-label="Return to Dashboard"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] bg-gold/10 border border-gold/20 text-gold px-2.5 py-0.5 rounded-full uppercase tracking-widest font-black font-mono">
                Canonical Marketplace
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase gold-text mt-0.5">
              I AM CHOSEN SHOP
            </h1>
          </div>
        </div>

        {/* Live balances & cart triggers */}
        <div className="flex items-center space-x-3">
          {wallet && (
            <div className="hidden sm:flex items-center space-x-2.5 bg-zinc-900 border border-zinc-800 rounded-2xl px-3.5 py-1.5 shadow-lg">
              <Wallet className="w-4 h-4 text-gold" />
              <div className="text-right">
                <span className="block text-[8px] uppercase tracking-wider text-zinc-500 font-bold font-mono">My Chosen Balance</span>
                <span className="text-xs font-black text-white">{wallet.chosenWalletBalance.toFixed(2)} CC</span>
              </div>
            </div>
          )}

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-cyan-500/30 text-white hover:text-cyan-400 transition-all duration-300 shadow-xl cursor-pointer"
            aria-label="Open Cart"
          >
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-cyan-500 text-black text-[10px] font-black rounded-full h-5 w-5 flex items-center justify-center animate-bounce border-2 border-zinc-950">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* VIEW SELECTOR BAR */}
      <div className="bg-[#11131a] border-b border-zinc-800/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex space-x-6">
          <button
            onClick={() => setActiveTab('shop')}
            className={`py-4 px-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
              activeTab === 'shop'
                ? 'border-gold text-gold font-black'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" /> Wellness Catalog
            </span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-4 px-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
              activeTab === 'orders'
                ? 'border-gold text-gold font-black'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> E-Commerce Orders ({orders.length})
            </span>
          </button>
        </div>
      </div>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center">
            <div className="relative mb-6 animate-pulse">
              <ChosenLogo size="lg" />
            </div>
            <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800/80 px-4 py-2 rounded-full mt-4">
              <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono">
                Syncing Live Inventory Ledger...
              </span>
            </div>
          </div>
        ) : error ? (
          <div className="py-16 text-center max-w-lg mx-auto">
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-3xl mb-6">
              <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
            <button
              onClick={fetchMarketplaceData}
              className="px-6 py-2.5 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-xs uppercase font-black tracking-wider hover:bg-zinc-850 cursor-pointer"
            >
              Try Reloading Again
            </button>
          </div>
        ) : activeTab === 'shop' ? (
          <div className="space-y-6">
            
            {/* HERO PROMOTIONAL BANNER */}
            <div className="relative rounded-3xl bg-gradient-to-r from-zinc-950 via-[#14161F] to-zinc-950 border border-zinc-800/80 p-6 sm:p-8 overflow-hidden shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="absolute top-0 right-0 w-96 h-96 bg-gold/5 rounded-full filter blur-[100px]" />
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/5 rounded-full filter blur-[100px]" />
              
              <div className="space-y-3 max-w-2xl relative z-10">
                <div className="flex items-center space-x-2">
                  <span className="text-[9px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-extrabold font-mono">
                    Premium Wellness Line
                  </span>
                  <span className="text-[9px] bg-gold/10 border border-gold/20 text-gold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-extrabold font-mono">
                    Direct Exchange
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase leading-none">
                  HEALTH, NUTRITION & <span className="gold-text">COMMERCE</span>
                </h2>
                <p className="text-zinc-400 text-xs sm:text-sm font-light leading-relaxed">
                  Redeem Chosen Credits (CC) seamlessly for verified high-grade nutrition, organic beverage supplements, and active herbal formulation products.
                </p>
              </div>

              {wallet && (
                <div className="shrink-0 relative z-10 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 flex flex-row md:flex-col items-center justify-between gap-4 w-full md:w-56 shadow-xl">
                  <div className="text-left md:text-center">
                    <span className="block text-[8px] uppercase tracking-widest text-zinc-500 font-bold font-mono">Available CC Balance</span>
                    <span className="text-2xl font-black text-gold font-mono">{wallet.chosenWalletBalance.toFixed(2)} CC</span>
                  </div>
                  <div className="text-zinc-500 text-[10px] font-mono tracking-wide text-center uppercase md:border-t md:border-zinc-800/80 md:pt-2 w-full">
                    ₱{Number(wallet.chosenWalletBalance * 70).toLocaleString()} Value
                  </div>
                </div>
              )}
            </div>

            {/* SEARCH & FILTERS BAR */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              
              {/* Search input */}
              <div className="lg:col-span-4 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search products, category, or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>

              {/* Category Filters Carousel (Horizontal Scrollable) */}
              <div className="lg:col-span-5 overflow-x-auto scrollbar-none flex space-x-1.5 py-1 px-0.5">
                {CATEGORIES.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                      selectedCategory === category
                        ? 'bg-gold/15 border-gold/30 text-gold font-black'
                        : 'bg-zinc-900/60 border-zinc-850 text-zinc-400 hover:text-white hover:border-zinc-800'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* Sorting Select Dropdown */}
              <div className="lg:col-span-3 flex items-center space-x-2 w-full">
                <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-400 focus:outline-none focus:border-gold/50 cursor-pointer"
                >
                  <option value="name">Sort by Name</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="stock">High Stock First</option>
                </select>
              </div>

            </div>

            {/* PRODUCT CATALOG GRID */}
            {filteredProducts.length === 0 ? (
              <div className="py-20 text-center bg-zinc-900/20 border border-dashed border-zinc-800/80 rounded-3xl">
                <p className="text-zinc-500 text-sm">No products found matching your active filter criteria.</p>
                <button
                  onClick={() => { setSearchQuery(''); setSelectedCategory('All Products'); }}
                  className="mt-4 px-4 py-2 bg-zinc-900 border border-zinc-850 hover:border-zinc-800 text-white rounded-xl text-[10px] uppercase font-black tracking-widest cursor-pointer"
                >
                  Clear Search Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map(product => {
                  const outOfStock = product.stock <= 0;
                  const lowStock = product.stock > 0 && product.stock <= 10;
                  
                  return (
                    <motion.div
                      key={product.id}
                      layoutId={`prod-card-${product.id}`}
                      className="bg-zinc-950/80 border border-zinc-900 hover:border-zinc-800/80 rounded-3xl p-5 flex flex-col justify-between hover:shadow-[0_4px_30px_rgba(212,175,55,0.02)] transition-all duration-300 group relative"
                    >
                      <div>
                        {/* Top layout */}
                        <div className="flex justify-between items-start gap-2 mb-4">
                          <div
                            onClick={() => setSelectedProduct(product)}
                            className="text-3xl p-3 bg-zinc-900/80 hover:bg-zinc-850 rounded-2xl group-hover:scale-105 transition-all duration-300 border border-zinc-800/60 flex items-center justify-center w-14 h-14 select-none cursor-pointer"
                          >
                            {getProductEmoji(product.id, product.name)}
                          </div>

                          <div className="flex flex-col items-end space-y-1">
                            <span className="text-[11px] font-black text-gold bg-[#D4AF37]/10 px-2.5 py-1 rounded-xl border border-[#D4AF37]/20 uppercase tracking-widest font-mono">
                              {product.priceCC} CC
                            </span>
                            <span className="text-[9px] font-semibold text-zinc-500 font-mono tracking-wider">
                              ₱{product.phpPrice.toLocaleString()} PHP
                            </span>
                          </div>
                        </div>

                        {/* Description and metadata */}
                        <div className="space-y-1 mb-4">
                          <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider block">
                            {product.category}
                          </span>
                          <h3
                            onClick={() => setSelectedProduct(product)}
                            className="font-extrabold text-white text-base sm:text-lg tracking-tight leading-tight group-hover:text-gold transition-colors cursor-pointer"
                          >
                            {product.name}
                          </h3>
                          <p className="text-zinc-500 text-[10px] font-mono tracking-widest uppercase">
                            SKU: {product.sku}
                          </p>
                          <p className="text-zinc-400 text-xs font-light leading-relaxed pt-1.5 line-clamp-2">
                            {getProductDescription(product.name)}
                          </p>
                        </div>
                      </div>

                      {/* Buy action & stock state */}
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between text-[10px] border-t border-zinc-900/60 pt-3">
                          <span className="text-zinc-500 font-bold uppercase tracking-widest font-mono">Stock Status</span>
                          {outOfStock ? (
                            <span className="text-rose-400 font-black uppercase tracking-wider bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                              Sold Out
                            </span>
                          ) : lowStock ? (
                            <span className="text-amber-400 font-black uppercase tracking-wider bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 animate-pulse">
                              Only {product.stock} Left
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-black uppercase tracking-wider bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                              {product.stock.toLocaleString()} Available
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedProduct(product)}
                            className="px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all text-xs font-bold cursor-pointer"
                            title="Product Details"
                          >
                            Details
                          </button>
                          <button
                            disabled={outOfStock}
                            onClick={() => addToCart(product, 1)}
                            className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer ${
                              outOfStock
                                ? 'bg-zinc-900 border border-zinc-850 text-zinc-600 cursor-not-allowed'
                                : 'bg-gold hover:bg-yellow-500 text-black font-extrabold shadow-gold/5'
                            }`}
                          >
                            <ShoppingCart className="w-3.5 h-3.5" /> Add to Cart
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

          </div>
        ) : (
          
          /* PAST ORDERS TAB */
          <div className="space-y-6">
            <div className="bg-zinc-950/80 border border-zinc-900 rounded-3xl p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6 border-b border-zinc-900 pb-4">
                <div>
                  <h2 className="text-lg font-black uppercase text-white tracking-tight">Order Procurement Ledger</h2>
                  <p className="text-xs text-zinc-500 font-light">Verified history of your product exchanges processed through Chosen Credits</p>
                </div>
                <History className="w-5 h-5 text-zinc-500" />
              </div>

              {orders.length === 0 ? (
                <div className="py-16 text-center">
                  <Package className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                  <p className="text-zinc-500 text-sm">No orders recorded in your history yet.</p>
                  <button
                    onClick={() => setActiveTab('shop')}
                    className="mt-4 px-6 py-2.5 bg-gold hover:bg-yellow-500 text-black rounded-xl text-xs uppercase font-black tracking-widest cursor-pointer"
                  >
                    Start Shopping Now
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((ord, idx) => (
                    <div
                      key={ord.id || idx}
                      className="bg-[#11131a] border border-zinc-900 rounded-2xl p-5 hover:border-zinc-800 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900/60 pb-3 mb-3">
                        <div>
                          <span className="text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-800/80 px-2.5 py-1 rounded-lg font-mono font-bold tracking-wider uppercase">
                            Order ID: {ord.id}
                          </span>
                          <span className="block text-zinc-500 text-[10px] font-mono mt-1.5">
                            Purchased on {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 'N/A'}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider block">Redemption Total</span>
                          <span className="text-base font-black text-gold font-mono">{ord.priceCC} CC</span>
                        </div>
                      </div>

                      {/* Items rendered */}
                      <div className="space-y-1.5">
                        <h4 className="text-[10px] text-zinc-500 uppercase tracking-widest font-black font-mono">Purchased Wellness Items</h4>
                        {ord.items ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                            {ord.items.map((item: any, i: number) => (
                              <div key={i} className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-3 flex justify-between items-center">
                                <div>
                                  <span className="text-xs font-bold text-white block">{item.name}</span>
                                  <span className="text-[10px] text-cyan-400 font-semibold">{item.category}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-zinc-500 block">Qty: {item.quantity}</span>
                                  <span className="text-xs font-bold text-gold font-mono">{item.priceCC * item.quantity} CC</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-300 font-medium pl-1">{ord.productName}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* SHOPPING CART SLIDE-OVER DRAWER */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="absolute inset-0 bg-black cursor-pointer"
            />

            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'tween', duration: 0.3 }}
                className="w-screen max-w-md bg-[#0D0F14] border-l border-zinc-800/80 flex flex-col justify-between"
              >
                
                {/* Cart Header */}
                <div className="p-6 border-b border-zinc-900 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <ShoppingCart className="w-5 h-5 text-gold" />
                    <h3 className="text-lg font-black uppercase text-white tracking-tight">Shopping Cart</h3>
                  </div>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-gold/30 hover:text-gold text-zinc-400 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Cart Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {cart.length === 0 ? (
                    <div className="py-20 text-center space-y-4">
                      <ShoppingBag className="w-12 h-12 text-zinc-800 mx-auto" />
                      <p className="text-zinc-500 text-xs">Your shopping cart is currently empty.</p>
                      <button
                        onClick={() => setIsCartOpen(false)}
                        className="px-4 py-2 bg-zinc-900 border border-zinc-850 hover:border-zinc-800 text-white rounded-xl text-[10px] uppercase font-black tracking-widest cursor-pointer"
                      >
                        Continue Browsing
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cart.map((item) => (
                        <div
                          key={item.product.id}
                          className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center space-x-3 truncate">
                            <span className="text-2xl shrink-0 p-2 bg-zinc-900 rounded-xl border border-zinc-800/80">
                              {getProductEmoji(item.product.id, item.product.name)}
                            </span>
                            <div className="truncate">
                              <h4 className="font-extrabold text-xs text-white truncate">{item.product.name}</h4>
                              <p className="text-[10px] text-cyan-400 uppercase tracking-wider font-semibold truncate mt-0.5">{item.product.category}</p>
                              <span className="text-[11px] font-bold text-gold font-mono block mt-1">{item.product.priceCC} CC each</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end shrink-0 space-y-2">
                            {/* Quantity buttons */}
                            <div className="flex items-center space-x-1.5 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                              <button
                                onClick={() => updateQuantity(item.product.id, -1)}
                                className="p-1 hover:bg-zinc-800 hover:text-white text-zinc-500 rounded transition-colors cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-black text-white px-1.5 font-mono min-w-[20px] text-center">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.product.id, 1)}
                                className="p-1 hover:bg-zinc-800 hover:text-white text-zinc-500 rounded transition-colors cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <button
                              onClick={() => removeFromCart(item.product.id)}
                              className="text-[9px] uppercase tracking-wider font-bold text-rose-500 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" /> Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cart Footer */}
                {cart.length > 0 && (
                  <div className="p-6 border-t border-zinc-900 bg-zinc-950/60 space-y-4">
                    <div className="space-y-2 border-b border-zinc-900 pb-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500 uppercase font-bold tracking-wider">Subtotal Quantity</span>
                        <span className="text-white font-mono font-bold">
                          {cart.reduce((sum, item) => sum + item.quantity, 0)} Units
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500 uppercase font-black text-xs tracking-wider">Total Exchange Value</span>
                        <span className="text-xl font-black text-gold font-mono">{getCartTotal()} CC</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={clearCart}
                        className="py-3 px-4 bg-zinc-900 border border-zinc-850 hover:border-rose-500/20 text-zinc-400 hover:text-rose-400 rounded-xl text-xs uppercase font-bold tracking-wider cursor-pointer"
                      >
                        Clear
                      </button>
                      <button
                        disabled={purchaseLoading}
                        onClick={handleCheckout}
                        className="flex-1 py-3 bg-gold hover:bg-yellow-500 text-black rounded-xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {purchaseLoading ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            <span>Processing Exchange...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            <span>Complete Purchase</span>
                          </>
                        )}
                      </button>
                    </div>

                    {wallet && (
                      <div className="text-center">
                        <span className="text-[10px] text-zinc-500">
                          Your CC balance after purchase: <strong className="text-zinc-300 font-mono">{(wallet.chosenWalletBalance - getCartTotal()).toFixed(2)} CC</strong>
                        </span>
                      </div>
                    )}
                  </div>
                )}

              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* PRODUCT DETAILS MODAL */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 bg-black cursor-pointer"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-[#0D0F14] border border-zinc-800/80 rounded-3xl overflow-hidden shadow-2xl relative z-10 p-6"
            >
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-gold/30 hover:text-gold text-zinc-400 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center text-center space-y-4 pt-4">
                <span className="text-5xl p-4 bg-zinc-900 rounded-2xl border border-zinc-800/60 select-none">
                  {getProductEmoji(selectedProduct.id, selectedProduct.name)}
                </span>
                
                <div>
                  <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest block mb-1">
                    {selectedProduct.category}
                  </span>
                  <h3 className="text-xl font-extrabold text-white uppercase tracking-tight">
                    {selectedProduct.name}
                  </h3>
                  <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase block mt-1">
                    SKU: {selectedProduct.sku}
                  </span>
                </div>

                {/* Info block */}
                <div className="grid grid-cols-2 gap-3 w-full bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4">
                  <div className="text-center">
                    <span className="block text-[8px] uppercase tracking-wider text-zinc-500 font-bold font-mono">Redemption Price</span>
                    <span className="text-lg font-black text-gold font-mono">{selectedProduct.priceCC} CC</span>
                  </div>
                  <div className="text-center border-l border-zinc-900">
                    <span className="block text-[8px] uppercase tracking-wider text-zinc-500 font-bold font-mono">PHP Value Ref</span>
                    <span className="text-lg font-black text-white font-mono">₱{selectedProduct.phpPrice.toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-left w-full space-y-2">
                  <h4 className="text-[10px] text-zinc-500 uppercase tracking-widest font-black font-mono">Product Description</h4>
                  <p className="text-zinc-300 text-xs font-light leading-relaxed">
                    {getProductDescription(selectedProduct.name)}
                  </p>
                </div>

                <div className="flex justify-between items-center w-full pt-4 border-t border-zinc-900">
                  <div className="text-left">
                    <span className="block text-[8px] uppercase tracking-wider text-zinc-500 font-bold font-mono">Inventory Stock</span>
                    <span className={`text-xs font-black uppercase tracking-wider ${
                      selectedProduct.stock <= 0 ? 'text-rose-400' : selectedProduct.stock <= 10 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {selectedProduct.stock <= 0 ? 'Sold Out' : `${selectedProduct.stock} Units Available`}
                    </span>
                  </div>

                  <button
                    disabled={selectedProduct.stock <= 0}
                    onClick={() => {
                      addToCart(selectedProduct, 1);
                      setSelectedProduct(null);
                    }}
                    className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md cursor-pointer ${
                      selectedProduct.stock <= 0
                        ? 'bg-zinc-900 border border-zinc-850 text-zinc-600 cursor-not-allowed'
                        : 'bg-gold hover:bg-yellow-500 text-black shadow-gold/5'
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" /> Add to Cart
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

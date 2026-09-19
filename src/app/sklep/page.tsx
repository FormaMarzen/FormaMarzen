'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '../raporty/klienci/supabase';
import { 
  Search, 
  ShoppingBag, 
  X, 
  Plus, 
  Minus, 
  Trash2, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle2, 
  Tag, 
  Dumbbell, 
  Loader2, 
  AlertCircle, 
  Phone, 
  User, 
  Mail, 
  FileText, 
  CreditCard, 
  Edit, 
  Eye, 
  EyeOff, 
  Settings2, 
  PackagePlus, 
  ShieldCheck, 
  Upload, 
  Image as ImageIcon, 
  History, 
  Receipt, 
  Clock, 
  CheckCheck, 
  FileSpreadsheet, 
  Lock,
  XCircle,
  RotateCcw,
  Ruler,
  Wallet,
  ArrowUpDown
} from 'lucide-react';

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  image_url: string;
  stock: number;
  badge?: string | null;
  is_active: boolean;
  size_chart_url?: string | null;
  available_sizes?: string | null;
  target_gender?: string | null;
  display_order?: number | null;
}

export interface CartItem {
  cartItemId: string;
  product: Product;
  quantity: number;
  selectedSize?: string;
  selectedGender?: string;
}

export interface OrderItemRecord {
  id?: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface OrderRecord {
  id: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_notes: string;
  payment_method: string;
  total_amount: number;
  status: string;
  order_items?: OrderItemRecord[];
}

interface OrderFormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingNotes: string;
  paymentMethod: 'autopay' | 'wallet';
}

interface ProductFormData {
  name: string;
  category: string;
  price: string;
  description: string;
  image_url: string;
  stock: string;
  badge: string;
  is_active: boolean;
  size_chart_url: string;
  target_gender: string;
  display_order: string;
  gender_stocks: {
    'Męski': Record<string, number>;
    'Damski': Record<string, number>;
    'Unisex': Record<string, number>;
  };
}

const DEFAULT_CATEGORIES: string[] = [
  'Odzież',
  'Suplementy',
  'Akcesoria',
  'Gadżety',
  'Usługi'
];

const STANDARD_SIZES: string[] = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

const INITIAL_PRODUCT_FORM: ProductFormData = {
  name: '',
  category: 'Odzież',
  price: '',
  description: '',
  image_url: '',
  stock: '10',
  badge: '',
  is_active: true,
  size_chart_url: '',
  target_gender: 'Unisex',
  display_order: '0',
  gender_stocks: {
    'Męski': { 'S': 5, 'M': 5, 'L': 5, 'XL': 5 },
    'Damski': { 'S': 5, 'M': 5, 'L': 5, 'XL': 5 },
    'Unisex': { 'S': 5, 'M': 5, 'L': 5, 'XL': 5 }
  }
};

export const parseProductSizeStocks = (raw: any, targetGender?: string | null): {
  isDualGender: boolean;
  stocks: {
    Męski: Record<string, number>;
    Damski: Record<string, number>;
    Unisex: Record<string, number>;
  };
} => {
  const result = {
    isDualGender: targetGender === 'Męski / Damski (do wyboru)',
    stocks: {
      Męski: {} as Record<string, number>,
      Damski: {} as Record<string, number>,
      Unisex: {} as Record<string, number>,
    }
  };

  if (!raw) return result;

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if ('Męski' in parsed || 'Damski' in parsed) {
        result.isDualGender = true;
        if (parsed['Męski'] && typeof parsed['Męski'] === 'object') {
          Object.entries(parsed['Męski']).forEach(([k, v]) => {
            result.stocks.Męski[k] = Number(v) || 0;
          });
        }
        if (parsed['Damski'] && typeof parsed['Damski'] === 'object') {
          Object.entries(parsed['Damski']).forEach(([k, v]) => {
            result.stocks.Damski[k] = Number(v) || 0;
          });
        }
        return result;
      }

      const flat: Record<string, number> = {};
      Object.entries(parsed).forEach(([k, v]) => {
        flat[k] = Number(v) || 0;
      });

      if (targetGender === 'Damski') {
        result.stocks.Damski = flat;
      } else if (targetGender === 'Męski') {
        result.stocks.Męski = flat;
      } else if (targetGender === 'Męski / Damski (do wyboru)') {
        result.isDualGender = true;
        result.stocks.Męski = { ...flat };
        result.stocks.Damski = { ...flat };
      } else {
        result.stocks.Unisex = flat;
      }
      return result;
    }

    if (Array.isArray(parsed)) {
      const flat: Record<string, number> = {};
      parsed.forEach((s) => {
        if (typeof s === 'string') flat[s] = 5;
      });
      result.stocks.Unisex = flat;
      result.stocks.Męski = { ...flat };
      result.stocks.Damski = { ...flat };
      return result;
    }
  } catch (e) {
    if (typeof raw === 'string') {
      const flat: Record<string, number> = {};
      raw.split(',').forEach((s) => {
        const trimmed = s.trim();
        if (trimmed) flat[trimmed] = 5;
      });
      result.stocks.Unisex = flat;
      result.stocks.Męski = { ...flat };
      result.stocks.Damski = { ...flat };
      return result;
    }
  }

  return result;
};

export default function ShopPage() {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.update();
        });
      });
    }
  }, []);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentClientRecord, setCurrentClientRecord] = useState<any>(null);

  const [deletedCategories, setDeletedCategories] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('fm_shop_deleted_categories');
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Bezpieczna inicjalizacja uprawnień - domyślnie false dla każdego klubowicza
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('fm_user_role');
      const storedEmail = (localStorage.getItem('fm_user_email') || '').toLowerCase().trim();
      if (storedRole === 'admin' && (storedEmail === 'maciejklaput@gmail.com' || storedEmail === 'maciejklaput@icloud.com')) {
        return true;
      }
    }
    return false;
  });

  const [adminEditMode, setAdminEditMode] = useState<boolean>(true);

  // Efektywny tryb administratora
  const isEffectiveAdmin = useMemo(() => {
    return isAdmin && adminEditMode;
  }, [isAdmin, adminEditMode]);

  const [selectedCategory, setSelectedCategory] = useState<string>('Wszystko');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [selectedProductSizes, setSelectedProductSizes] = useState<Record<string, string>>({});
  const [selectedProductGenders, setSelectedProductGenders] = useState<Record<string, string>>({});
  const [sizeWarningProductId, setSizeWarningProductId] = useState<string | null>(null);

  const [adminActiveGenderTab, setAdminActiveGenderTab] = useState<'Męski' | 'Damski'>('Męski');

  const [activeSizeChartUrl, setActiveSizeChartUrl] = useState<string | null>(null);
  const [activeSizeChartTitle, setActiveSizeChartTitle] = useState<string>('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'form'>('cart');
  const [orderSuccess, setOrderSuccess] = useState<boolean>(false);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string>('Zamówienie zostało zarejestrowane!');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isSubmittingRef = useRef<boolean>(false);

  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [ordersHistory, setOrdersHistory] = useState<OrderRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'my'>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  const [formData, setFormData] = useState<OrderFormData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    shippingNotes: '',
    paymentMethod: 'autopay',
  });

  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductFormData>(INITIAL_PRODUCT_FORM);
  const [isCustomCategory, setIsCustomCategory] = useState<boolean>(false);
  const [savingProduct, setSavingProduct] = useState<boolean>(false);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [isProcessingSizeChart, setIsProcessingSizeChart] = useState<boolean>(false);
  const [productModalError, setProductModalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sizeChartFileInputRef = useRef<HTMLInputElement>(null);

  // Pobranie danych zalogowanego klubowicza ze ścisłym dopasowaniem e-mail
  const fetchLoggedMemberData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const storedEmail = (typeof window !== 'undefined' ? localStorage.getItem('fm_user_email') : '') || '';
      const authEmail = (user?.email || storedEmail).toLowerCase().trim();

      if (!authEmail) return;

      const { data: clients } = await supabase.from('klienci').select('*');

      if (clients && clients.length > 0) {
        let matched = clients.find((c: any) => {
          const cEmail = (c['E-mail'] || c.email || '').toLowerCase().trim();
          return authEmail && cEmail === authEmail;
        });

        // Tylko dla Twoich kont administratora pozwalamy na fallback
        if (!matched && (authEmail === 'maciejklaput@gmail.com' || authEmail === 'maciejklaput@icloud.com')) {
          matched = clients.find((c: any) => {
            const nazwisko = (c.Nazwisko || c.nazwisko || '').toLowerCase().trim();
            return nazwisko.includes('kłaput');
          });
        }

        if (matched) {
          setCurrentClientRecord(matched);
          const fullName = `${matched.Imię || ''} ${matched.Nazwisko || ''}`.trim();
          const phone = matched['Numer tel.'] && matched['Numer tel.'] !== '-' ? matched['Numer tel.'] : '';
          const memberEmail = matched['E-mail'] || matched.email || authEmail;

          setFormData((prev) => ({
            ...prev,
            customerName: fullName || authEmail.split('@')[0],
            customerEmail: memberEmail,
            customerPhone: phone,
          }));
          return;
        }
      }

      setFormData((prev) => ({
        ...prev,
        customerEmail: authEmail,
        customerName: authEmail.split('@')[0],
      }));
    } catch (err) {
      console.error('Błąd pobierania danych klubowicza:', err);
    }
  };

  useEffect(() => {
    fetchLoggedMemberData();
  }, []);

  const clientWalletBalance = useMemo(() => {
    if (!currentClientRecord) return 0;
    const rawWallet = currentClientRecord.Portfel ?? currentClientRecord.portfel ?? '0.00 PLN';
    if (typeof rawWallet === 'number') return rawWallet;
    const isNeg = String(rawWallet).includes('-');
    let num = parseFloat(String(rawWallet).replace(/[^0-9.]/g, '')) || 0;
    return isNeg ? -Math.abs(num) : num;
  }, [currentClientRecord]);

  const isMemberLoggedIn = useMemo(() => {
    return Boolean(formData.customerEmail && formData.customerEmail.trim().length > 0);
  }, [formData.customerEmail]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();

    DEFAULT_CATEGORIES.forEach((cat) => {
      if (!deletedCategories.includes(cat)) {
        set.add(cat);
      }
    });

    products.forEach((p) => {
      if (p.category && p.category.trim() && !deletedCategories.includes(p.category.trim())) {
        set.add(p.category.trim());
      }
    });

    return Array.from(set);
  }, [products, deletedCategories]);

  const filterCategories = useMemo(() => {
    return ['Wszystko', ...availableCategories];
  }, [availableCategories]);

  // Ścisła weryfikacja roli administratora bez fałszywych dopasowań
  useEffect(() => {
    const verifyAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !user.email) {
          setIsAdmin(false);
          return;
        }

        const email = user.email.toLowerCase().trim();
        if (email === 'maciejklaput@gmail.com' || email === 'maciejklaput@icloud.com') {
          setIsAdmin(true);
          localStorage.setItem('fm_user_role', 'admin');
          return;
        }

        const { data: clients } = await supabase.from('klienci').select('*');
        if (clients && clients.length > 0) {
          const currentClient = clients.find((c: any) => {
            const cEmail = (c['E-mail'] || c.email || '').toLowerCase().trim();
            return cEmail === email;
          });

          if (currentClient && String(currentClient.rola || '').toLowerCase() === 'admin') {
            setIsAdmin(true);
            localStorage.setItem('fm_user_role', 'admin');
            return;
          }
        }

        // Zwykły klubowicz: blokada i czyszczenie roli
        setIsAdmin(false);
        if (localStorage.getItem('fm_user_role') === 'admin') {
          localStorage.setItem('fm_user_role', 'klubowicz');
        }
      } catch (e) {
        console.error('Weryfikacja admina:', e);
        setIsAdmin(false);
      }
    };

    verifyAdmin();
  }, []);

  // Pobieranie produktów ze sklepu
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setProducts(data || []);
    } catch (err: unknown) {
      console.error('Błąd pobierania produktów:', err);
      setError('Nie udało się pobrać listy produktów. Spróbuj odświeżyć stronę.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Przesuwanie kolejności produktów (dostępne tylko dla administratora)
  const handleMoveProduct = async (product: Product, direction: 'prev' | 'next') => {
    if (!isEffectiveAdmin) return;
    const list = [...filteredProducts];
    const currentIndex = list.findIndex(p => p.id === product.id);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const temp = list[currentIndex];
    list[currentIndex] = list[targetIndex];
    list[targetIndex] = temp;

    const updates = list.map((p, idx) => ({
      id: p.id,
      display_order: idx + 1
    }));

    setProducts(prev => {
      const updatedList = prev.map(p => {
        const found = updates.find(u => u.id === p.id);
        return found ? { ...p, display_order: found.display_order } : p;
      });
      return updatedList.sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999));
    });

    try {
      await Promise.all(
        updates.map(u => supabase.from('products').update({ display_order: u.display_order }).eq('id', u.id))
      );
    } catch (err) {
      console.error("Błąd zapisu kolejności:", err);
    }
  };

  const fetchOrderHistory = async () => {
    try {
      setHistoryLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      const candidateEmails = Array.from(
        new Set(
          [
            user?.email,
            formData.customerEmail,
            currentClientRecord?.['E-mail'],
            currentClientRecord?.email,
            typeof window !== 'undefined' ? localStorage.getItem('fm_user_email') : null,
          ]
            .filter((e): e is string => Boolean(e && typeof e === 'string' && e.trim().length > 0))
            .map((e) => e.toLowerCase().trim())
        )
      );

      let query = supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });

      if (!isEffectiveAdmin || historyFilter === 'my') {
        if (candidateEmails.length === 0) {
          setOrdersHistory([]);
          setHistoryLoading(false);
          return;
        }

        if (candidateEmails.length === 1) {
          query = query.ilike('customer_email', candidateEmails[0]);
        } else {
          const orFilter = candidateEmails.map((e) => `customer_email.ilike.${e}`).join(',');
          query = query.or(orFilter);
        }
      }

      const { data, error: ordersErr } = await query;
      if (ordersErr) throw ordersErr;

      setOrdersHistory(data || []);
    } catch (err) {
      console.error('Błąd pobierania zamówień:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (isHistoryOpen) {
      fetchOrderHistory();
    }
  }, [isHistoryOpen, historyFilter, isEffectiveAdmin]);

  const handleSetOrderStatus = async (orderId: string, newStatus: string) => {
    if (!isEffectiveAdmin) return;

    try {
      const { error: updateErr } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (updateErr) throw updateErr;

      setOrdersHistory((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, status: newStatus } : ord))
      );
    } catch (err: any) {
      console.error('Błąd aktualizacji statusu:', err);
      alert('Nie udało się zmienić statusu zamówienia: ' + (err.message || 'Błąd zapisu w bazie'));
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!isEffectiveAdmin) return;
    const confirmCancel = window.confirm(
      'Czy na pewno chcesz anulować to zamówienie? Zamówienie pozostanie w historii ze statusem "Anulowano".'
    );
    if (!confirmCancel) return;

    await handleSetOrderStatus(orderId, 'anulowano');
  };

  const filteredOrdersHistory = useMemo(() => {
    return ordersHistory.filter((ord) => {
      const query = historySearchQuery.toLowerCase().trim();
      if (!query) return true;

      const matchesName = (ord.customer_name || '').toLowerCase().includes(query);
      const matchesEmail = (ord.customer_email || '').toLowerCase().includes(query);
      const matchesPhone = (ord.customer_phone || '').toLowerCase().includes(query);
      const matchesItems = ord.order_items?.some((it) => 
        (it.product_name || '').toLowerCase().includes(query)
      );

      return matchesName || matchesEmail || matchesPhone || matchesItems;
    });
  }, [ordersHistory, historySearchQuery]);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('fm_shop_cart');
      if (savedCart) setCart(JSON.parse(savedCart));
    } catch (e) {
      console.error('Błąd odczytu koszyka:', e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('fm_shop_cart', JSON.stringify(cart));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('fm_cart_updated'));
      }
    } catch (e) {
      console.error('Błąd zapisu koszyka:', e);
    }
  }, [cart]);

  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      if (!isEffectiveAdmin) {
        if (!item.is_active) return false;
      }

      const matchesCategory =
        selectedCategory === 'Wszystko' || item.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery, isEffectiveAdmin]);

  const handleAddToCartWithValidation = (product: Product) => {
    const isClothing = product.category.toLowerCase().includes('odzież') || product.category.toLowerCase().includes('odziez');
    const parsedData = parseProductSizeStocks(product.available_sizes, product.target_gender);

    let activeGender = selectedProductGenders[product.id];
    if (!activeGender) {
      if (parsedData.isDualGender) {
        activeGender = 'Męski';
      } else {
        activeGender = product.target_gender || 'Unisex';
      }
    }

    const currentGenderStocks = parsedData.isDualGender
      ? (activeGender === 'Damski' ? parsedData.stocks.Damski : parsedData.stocks.Męski)
      : (product.target_gender === 'Damski' ? parsedData.stocks.Damski : product.target_gender === 'Męski' ? parsedData.stocks.Męski : parsedData.stocks.Unisex);

    const hasSizes = Object.keys(currentGenderStocks).length > 0;
    const selectedSize = selectedProductSizes[product.id];

    if (isClothing && hasSizes) {
      if (!selectedSize) {
        setSizeWarningProductId(product.id);
        setTimeout(() => setSizeWarningProductId(null), 3000);
        return;
      }

      const availableQtyForSize = currentGenderStocks[selectedSize] ?? 0;
      if (availableQtyForSize <= 0) {
        alert(`Krój ${activeGender}, rozmiar ${selectedSize} jest wyprzedany.`);
        return;
      }

      const cartKey = `${product.id}_${activeGender}_${selectedSize}`;
      const inCartItem = cart.find(c => c.cartItemId === cartKey);
      if (inCartItem && inCartItem.quantity >= availableQtyForSize) {
        alert(`Nie możesz dodać więcej sztuk (${activeGender}, ${selectedSize}). Dostępna ilość na stanie to: ${availableQtyForSize} szt.`);
        return;
      }
    } else {
      const inCartQty = cart.filter(c => c.product.id === product.id).reduce((sum, i) => sum + i.quantity, 0);
      if (inCartQty >= product.stock) {
        alert(`Osiągnięto limit dostępnego stanu magazynowego tego produktu (${product.stock} szt.).`);
        return;
      }
    }

    const cartKey = `${product.id}_${activeGender}_${selectedSize || 'none'}`;

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.cartItemId === cartKey);
      if (existing) {
        return prevCart.map((item) =>
          item.cartItemId === cartKey
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prevCart,
        {
          cartItemId: cartKey,
          product,
          quantity: 1,
          selectedSize: selectedSize || undefined,
          selectedGender: activeGender || undefined,
        },
      ];
    });

    setIsCartOpen(true);
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;

            if (delta > 0) {
              const isClothing = item.product.category.toLowerCase().includes('odzież') || item.product.category.toLowerCase().includes('odziez');
              const parsedData = parseProductSizeStocks(item.product.available_sizes, item.product.target_gender);
              
              if (isClothing && item.selectedSize) {
                const currentGenderStocks = parsedData.isDualGender
                  ? (item.selectedGender === 'Damski' ? parsedData.stocks.Damski : parsedData.stocks.Męski)
                  : (item.product.target_gender === 'Damski' ? parsedData.stocks.Damski : item.product.target_gender === 'Męski' ? parsedData.stocks.Męski : parsedData.stocks.Unisex);

                const maxStock = currentGenderStocks[item.selectedSize] ?? item.product.stock;
                if (newQty > maxStock) {
                  alert(`Maksymalna ilość (${item.selectedGender || ''} ${item.selectedSize}) dostępna na stanie to ${maxStock} szt.`);
                  return item;
                }
              } else if (newQty > item.product.stock) {
                alert(`Maksymalna dostępna ilość produktu na stanie to ${item.product.stock} szt.`);
                return item;
              }
            }

            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.cartItemId !== cartItemId));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  }, [cart]);

  const redirectToShopAutopay = async (amount: number, orderId: string, description: string, orderDbId: string) => {
    try {
      const userId = currentClientRecord?.id || Date.now();
      const clientEmail = formData.customerEmail.trim();

      const response = await fetch('/api/autopay/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          orderId: orderId,
          userId: userId,
          description: description,
          email: clientEmail,
          type: 'shop_order',
          metadata: {
            order_db_id: orderDbId,
            customer_name: formData.customerName,
            customer_phone: formData.customerPhone,
            shipping_notes: formData.shippingNotes
          }
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Nie udało się zainicjalizować płatności w bramce AutoPay');
      }

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.gatewayUrl;
      form.setAttribute('accept-charset', 'UTF-8');

      Object.keys(data.payload).forEach((key) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = data.payload[key];
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (err: any) {
      console.error("Błąd przekierowania do bramki AutoPay:", err);
      throw err;
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (isSubmittingRef.current) return;

    if (!isMemberLoggedIn) {
      setSubmitError('Zakupy w sklepie są dostępne wyłącznie dla zalogowanych klubowiczów.');
      return;
    }

    if (!formData.customerName.trim() || !formData.customerEmail.trim()) {
      setSubmitError('Brak wymaganych danych klubowicza do autoryzacji zamówienia.');
      return;
    }

    const isWalletPayment = formData.paymentMethod === 'wallet';

    if (isWalletPayment) {
      if (clientWalletBalance < cartTotal) {
        setSubmitError(
          `Niewystarczające środki w portfelu. Posiadasz ${clientWalletBalance.toFixed(2)} PLN, a kwota zamówienia wynosi ${cartTotal.toFixed(2)} PLN. Wybierz AutoPay lub doładuj portfel.`
        );
        return;
      }
    }

    try {
      isSubmittingRef.current = true;
      setIsCheckingOut(true);

      const paymentMethodName = isWalletPayment ? 'Portfel' : 'AutoPay';
      const initialStatus = isWalletPayment ? 'opłacone' : 'pending';

      const orderPayload = {
        customer_name: formData.customerName.trim(),
        customer_email: formData.customerEmail.trim(),
        customer_phone: formData.customerPhone.trim() || '-',
        shipping_notes: formData.shippingNotes.trim(),
        payment_method: paymentMethodName,
        total_amount: cartTotal,
        status: initialStatus
      };

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([orderPayload])
        .select()
        .single();

      if (orderError || !orderData) {
        throw new Error(orderError?.message || 'Błąd zapisu zamówienia w bazie.');
      }

      const orderItems = cart.map((item) => {
        let fullName = item.product.name;
        const details = [];
        if (item.selectedGender) details.push(item.selectedGender);
        if (item.selectedSize) details.push(`Rozmiar: ${item.selectedSize}`);

        if (details.length > 0) {
          fullName += ` (${details.join(', ')})`;
        }

        return {
          order_id: orderData.id,
          product_id: item.product.id,
          product_name: fullName,
          quantity: item.quantity,
          unit_price: item.product.price
        };
      });

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw new Error(itemsError.message);

      if (isWalletPayment) {
        const newWalletNum = clientWalletBalance - cartTotal;
        const newWalletStr = `${newWalletNum.toFixed(2)} PLN`;

        if (currentClientRecord?.id) {
          await supabase
            .from('klienci')
            .update({
              Portfel: newWalletStr,
              portfel: newWalletNum
            })
            .eq('id', currentClientRecord.id);

          await supabase.from('transakcje').insert([{
            klient_id: currentClientRecord.id,
            typ_operacji: 'sklep_portfel',
            kwota: -cartTotal,
            opis: `Zakup w sklepie klubowym z portfela: Zamówienie #${orderData.id.slice(0, 8)}`
          }]);
        }

        for (const item of cart) {
          const isClothing = item.product.category.toLowerCase().includes('odzież') || item.product.category.toLowerCase().includes('odziez');
          const newTotalStock = Math.max(0, item.product.stock - item.quantity);

          let updatedSizesPayload: any = item.product.available_sizes;

          if (isClothing && item.selectedSize && item.product.available_sizes) {
            const parsed = parseProductSizeStocks(item.product.available_sizes, item.product.target_gender);
            const genderKey = (item.selectedGender === 'Damski' ? 'Damski' : item.selectedGender === 'Męski' ? 'Męski' : 'Unisex') as 'Męski' | 'Damski' | 'Unisex';

            if (parsed.isDualGender) {
              const currentStock = parsed.stocks[genderKey][item.selectedSize] ?? item.quantity;
              parsed.stocks[genderKey][item.selectedSize] = Math.max(0, currentStock - item.quantity);
              updatedSizesPayload = JSON.stringify({
                'Męski': parsed.stocks.Męski,
                'Damski': parsed.stocks.Damski
              });
            } else {
              const currentStock = parsed.stocks[genderKey][item.selectedSize] ?? item.quantity;
              parsed.stocks[genderKey][item.selectedSize] = Math.max(0, currentStock - item.quantity);
              updatedSizesPayload = JSON.stringify(parsed.stocks[genderKey]);
            }
          }

          await supabase
            .from('products')
            .update({
              stock: newTotalStock,
              available_sizes: updatedSizesPayload,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.product.id);
        }

        setOrderSuccessMessage(`Zamówienie zostało pomyślnie opłacone z Twojego portfela! Nowy stan portfela: ${newWalletStr}`);
        setOrderSuccess(true);
        setCart([]);
        localStorage.removeItem('fm_shop_cart');
        await fetchProducts();
        await fetchLoggedMemberData();

        setTimeout(() => {
          setOrderSuccess(false);
          setIsCartOpen(false);
          setCheckoutStep('cart');
        }, 3500);

      } else {
        const autopayOrderId = `SHOP-${orderData.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}-${Date.now()}`.substring(0, 32);
        const opisOperacji = `Sklep Forma Marzen - Zamowienie #${orderData.id.slice(0, 8)}`;

        setOrderSuccessMessage('Zamówienie zostało zarejestrowane! Przekierowywanie do płatności AutoPay...');
        setOrderSuccess(true);
        setCart([]);
        localStorage.removeItem('fm_shop_cart');

        await redirectToShopAutopay(cartTotal, autopayOrderId, opisOperacji, orderData.id);
      }

    } catch (err: any) {
      console.error('Błąd realizacji zamówienia:', err);
      const exactError = err?.message || err?.error_description || 'Wystąpił problem podczas przetwarzania.';
      setSubmitError(`Błąd realizacji płatności: ${exactError}`);
    } finally {
      isSubmittingRef.current = false;
      setIsCheckingOut(false);
    }
  };

  const handleDeleteCategory = async (catToDelete: string) => {
    if (!isEffectiveAdmin || catToDelete === 'Wszystko') {
      return;
    }

    const remainingCategories = availableCategories.filter((c) => c !== catToDelete && c !== 'Wszystko');
    const fallbackCat = remainingCategories[0] || 'Inne';

    const confirmDelete = window.confirm(
      `Czy na pewno chcesz usunąć kategorię "${catToDelete}" z paska sklepu? Produkty z tej kategorii zostaną przypisane do kategorii "${fallbackCat}".`
    );
    if (!confirmDelete) return;

    try {
      setLoading(true);

      const { error: updateErr } = await supabase
        .from('products')
        .update({ category: fallbackCat, updated_at: new Date().toISOString() })
        .eq('category', catToDelete);

      if (updateErr) throw updateErr;

      const updatedDeleted = Array.from(new Set([...deletedCategories, catToDelete]));
      setDeletedCategories(updatedDeleted);
      if (typeof window !== 'undefined') {
        localStorage.setItem('fm_shop_deleted_categories', JSON.stringify(updatedDeleted));
      }

      if (selectedCategory.toLowerCase() === catToDelete.toLowerCase()) {
        setSelectedCategory('Wszystko');
      }

      await fetchProducts();
    } catch (err: any) {
      console.error('Błąd usuwania kategorii:', err);
      alert('Wystąpił błąd podczas usuwania kategorii: ' + (err.message || 'Błąd bazy danych'));
    } finally {
      setLoading(false);
    }
  };

  const compressImageFile = (file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.82): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } else {
            reject(new Error('Canvas context error'));
          }
        };
        img.onerror = () => reject(new Error('Błąd odczytu grafiki'));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Błąd pliku'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingImage(true);
      setProductModalError(null);
      const compressedDataUrl = await compressImageFile(file, 900, 900, 0.82);
      setProductForm((prev) => ({ ...prev, image_url: compressedDataUrl }));
    } catch (err) {
      setProductModalError('Nie udało się przetworzyć pliku graficznego.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleSizeChartUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingSizeChart(true);
      setProductModalError(null);
      const compressedDataUrl = await compressImageFile(file, 1200, 1200, 0.85);
      setProductForm((prev) => ({ ...prev, size_chart_url: compressedDataUrl }));
    } catch (err) {
      setProductModalError('Nie udało się przetworzyć tabeli rozmiarów.');
    } finally {
      setIsProcessingSizeChart(false);
    }
  };

  const handleOpenAddModal = () => {
    if (!isEffectiveAdmin) return;
    setEditingProductId(null);
    setProductForm(INITIAL_PRODUCT_FORM);
    setAdminActiveGenderTab('Męski');
    setIsCustomCategory(false);
    setProductModalError(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    if (!isEffectiveAdmin) return;
    setEditingProductId(product.id);
    const hasCategoryInList = availableCategories.includes(product.category);
    setIsCustomCategory(!hasCategoryInList);
    
    const parsed = parseProductSizeStocks(product.available_sizes, product.target_gender);

    setProductForm({
      name: product.name,
      category: product.category || 'Odzież',
      price: product.price.toString(),
      description: product.description || '',
      image_url: product.image_url || '',
      stock: product.stock.toString(),
      badge: product.badge || '',
      is_active: product.is_active,
      size_chart_url: product.size_chart_url || '',
      target_gender: product.target_gender || 'Unisex',
      display_order: (product.display_order ?? 0).toString(),
      gender_stocks: {
        'Męski': Object.keys(parsed.stocks.Męski).length > 0 ? parsed.stocks.Męski : { 'S': 5, 'M': 5, 'L': 5, 'XL': 5 },
        'Damski': Object.keys(parsed.stocks.Damski).length > 0 ? parsed.stocks.Damski : { 'S': 5, 'M': 5, 'L': 5, 'XL': 5 },
        'Unisex': Object.keys(parsed.stocks.Unisex).length > 0 ? parsed.stocks.Unisex : { 'S': 5, 'M': 5, 'L': 5, 'XL': 5 },
      }
    });

    setAdminActiveGenderTab('Męski');
    setProductModalError(null);
    setIsProductModalOpen(true);
  };

  const toggleSizeInForm = (genderKey: 'Męski' | 'Damski' | 'Unisex', size: string) => {
    setProductForm((prev) => {
      const currentGenderStock = { ...prev.gender_stocks[genderKey] };
      if (size in currentGenderStock) {
        delete currentGenderStock[size];
      } else {
        currentGenderStock[size] = 5;
      }

      const updatedGenderStocks = {
        ...prev.gender_stocks,
        [genderKey]: currentGenderStock
      };

      let sumStock = 0;
      if (prev.target_gender === 'Męski / Damski (do wyboru)') {
        sumStock = 
          Object.values(updatedGenderStocks['Męski']).reduce((a, b) => a + b, 0) +
          Object.values(updatedGenderStocks['Damski']).reduce((a, b) => a + b, 0);
      } else if (prev.target_gender === 'Damski') {
        sumStock = Object.values(updatedGenderStocks['Damski']).reduce((a, b) => a + b, 0);
      } else if (prev.target_gender === 'Męski') {
        sumStock = Object.values(updatedGenderStocks['Męski']).reduce((a, b) => a + b, 0);
      } else {
        sumStock = Object.values(updatedGenderStocks['Unisex']).reduce((a, b) => a + b, 0);
      }

      return {
        ...prev,
        gender_stocks: updatedGenderStocks,
        stock: sumStock.toString()
      };
    });
  };

  const updateSizeStockInForm = (genderKey: 'Męski' | 'Damski' | 'Unisex', size: string, quantity: number) => {
    setProductForm((prev) => {
      const currentGenderStock = {
        ...prev.gender_stocks[genderKey],
        [size]: Math.max(0, quantity)
      };

      const updatedGenderStocks = {
        ...prev.gender_stocks,
        [genderKey]: currentGenderStock
      };

      let sumStock = 0;
      if (prev.target_gender === 'Męski / Damski (do wyboru)') {
        sumStock = 
          Object.values(updatedGenderStocks['Męski']).reduce((a, b) => a + b, 0) +
          Object.values(updatedGenderStocks['Damski']).reduce((a, b) => a + b, 0);
      } else if (prev.target_gender === 'Damski') {
        sumStock = Object.values(updatedGenderStocks['Damski']).reduce((a, b) => a + b, 0);
      } else if (prev.target_gender === 'Męski') {
        sumStock = Object.values(updatedGenderStocks['Męski']).reduce((a, b) => a + b, 0);
      } else {
        sumStock = Object.values(updatedGenderStocks['Unisex']).reduce((a, b) => a + b, 0);
      }

      return {
        ...prev,
        gender_stocks: updatedGenderStocks,
        stock: sumStock.toString()
      };
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductModalError(null);

    const priceNum = parseFloat(productForm.price.replace(',', '.'));
    const isClothing = productForm.category.toLowerCase().includes('odzież') || productForm.category.toLowerCase().includes('odziez');
    const orderNum = parseInt(productForm.display_order, 10) || 0;
    
    let stockNum = parseInt(productForm.stock, 10);
    let sizesPayload: any = null;

    if (isClothing) {
      if (productForm.target_gender === 'Męski / Damski (do wyboru)') {
        sizesPayload = JSON.stringify({
          'Męski': productForm.gender_stocks['Męski'],
          'Damski': productForm.gender_stocks['Damski']
        });
        stockNum = 
          Object.values(productForm.gender_stocks['Męski']).reduce((a, b) => a + b, 0) +
          Object.values(productForm.gender_stocks['Damski']).reduce((a, b) => a + b, 0);
      } else if (productForm.target_gender === 'Damski') {
        sizesPayload = JSON.stringify(productForm.gender_stocks['Damski']);
        stockNum = Object.values(productForm.gender_stocks['Damski']).reduce((a, b) => a + b, 0);
      } else if (productForm.target_gender === 'Męski') {
        sizesPayload = JSON.stringify(productForm.gender_stocks['Męski']);
        stockNum = Object.values(productForm.gender_stocks['Męski']).reduce((a, b) => a + b, 0);
      } else {
        sizesPayload = JSON.stringify(productForm.gender_stocks['Unisex']);
        stockNum = Object.values(productForm.gender_stocks['Unisex']).reduce((a, b) => a + b, 0);
      }
    }

    const finalCategory = productForm.category.trim();

    if (!productForm.name.trim()) {
      setProductModalError('Nazwa produktu jest wymagana.');
      return;
    }
    if (!finalCategory) {
      setProductModalError('Kategoria produktu jest wymagana.');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setProductModalError('Podaj prawidłową cenę produktu.');
      return;
    }
    if (isNaN(stockNum) || stockNum < 0) {
      setProductModalError('Podaj prawidłowy stan magazynowy.');
      return;
    }

    try {
      setSavingProduct(true);

      if (deletedCategories.includes(finalCategory)) {
        const updatedDeleted = deletedCategories.filter((c) => c !== finalCategory);
        setDeletedCategories(updatedDeleted);
        if (typeof window !== 'undefined') {
          localStorage.setItem('fm_shop_deleted_categories', JSON.stringify(updatedDeleted));
        }
      }

      const payload = {
        name: productForm.name.trim(),
        category: finalCategory,
        price: priceNum,
        description: productForm.description.trim(),
        image_url: productForm.image_url.trim(),
        stock: stockNum,
        badge: productForm.badge.trim() ? productForm.badge.trim() : null,
        is_active: productForm.is_active,
        size_chart_url: productForm.size_chart_url.trim() || null,
        available_sizes: sizesPayload,
        target_gender: productForm.target_gender || 'Unisex',
        display_order: orderNum,
        updated_at: new Date().toISOString()
      };

      if (editingProductId) {
        const { error: updateErr } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProductId);

        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('products')
          .insert([payload]);

        if (insertErr) throw insertErr;
      }

      setIsProductModalOpen(false);
      await fetchProducts();
    } catch (err: any) {
      console.error('Błąd zapisu produktu:', err);
      setProductModalError(err.message || 'Wystąpił błąd podczas zapisywania produktu.');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleToggleProductStatus = async (product: Product) => {
    if (!isEffectiveAdmin) return;
    try {
      const { error: toggleErr } = await supabase
        .from('products')
        .update({ is_active: !product.is_active, updated_at: new Date().toISOString() })
        .eq('id', product.id);

      if (toggleErr) throw toggleErr;

      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_active: !p.is_active } : p))
      );
    } catch (err) {
      console.error('Błąd zmiany widoczności:', err);
      alert('Nie udało się zaktualizować widoczności produktu.');
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!isEffectiveAdmin) return;
    const confirmDelete = window.confirm(`Czy na pewno chcesz usunąć produkt: "${product.name}"?`);
    if (!confirmDelete) return;

    try {
      const { error: delErr } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (delErr) throw delErr;

      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setCart((prev) => prev.filter((item) => item.product.id !== product.id));
    } catch (err: any) {
      console.error('Błąd usuwania:', err);
      alert('Nie udało się usunąć produktu: ' + err.message);
    }
  };

  return (
    <div className="w-full rounded-3xl bg-zinc-950 text-zinc-100 p-4 sm:p-6 md:p-8 shadow-2xl border border-zinc-800">
      
      {/* Nagłówek sklepu */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 shadow-inner">
            <Dumbbell className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                Sklep Klubowy
              </h1>
              {isEffectiveAdmin && (
                <span className="flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-400 border border-amber-500/30">
                  <ShieldCheck className="h-3 w-3" />
                  Admin
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">FORMA MARZEŃ Official Merch & Supplements</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              if (isEffectiveAdmin) {
                setHistoryFilter('all');
              } else {
                setHistoryFilter('my');
              }
              setIsHistoryOpen(true);
            }}
            className="relative flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-zinc-200 ring-1 ring-zinc-800 transition-all hover:bg-zinc-800 hover:text-white active:scale-95 cursor-pointer"
            aria-label={isEffectiveAdmin ? "Tabela zamówień" : "Twoje zamówienia"}
            title={isEffectiveAdmin ? "Tabela wszystkich zamówień klubowiczów" : "Twoja historia zakupów"}
          >
            {isEffectiveAdmin ? <FileSpreadsheet className="h-5 w-5 text-amber-400" /> : <History className="h-5 w-5 text-amber-400" />}
            <span className="hidden sm:inline">{isEffectiveAdmin ? 'Tabela zamówień' : 'Moje zamówienia'}</span>
          </button>

          <button
            onClick={() => {
              setCheckoutStep('cart');
              setIsCartOpen(true);
            }}
            className="relative flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-zinc-200 ring-1 ring-zinc-800 transition-all hover:bg-zinc-800 hover:text-white active:scale-95 cursor-pointer"
            aria-label="Otwórz koszyk"
          >
            <ShoppingBag className="h-5 w-5 text-amber-400" />
            <span>Koszyk</span>
            {cartItemCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-black">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Złoty Panel Administratora - Widoczny WYŁĄCZNIE dla aktywnego administratora */}
      {isEffectiveAdmin && (
        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-amber-400" />
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-300 block">
                  Panel Zarządzania Asortymentem
                </span>
                <span className="text-[11px] text-zinc-300">
                  {adminEditMode 
                    ? 'Tryb edycji aktywny – pełne zarządzanie kolejnością (strzałki ◀ ▶ na kafelkach), odzieżą, krojami i stanami' 
                    : 'Podgląd klubowicza aktywny – widzisz sklep dokładnie tak jak klient'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {adminEditMode && (
                <button
                  type="button"
                  onClick={() => {
                    setHistoryFilter('all');
                    setIsHistoryOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-xl bg-zinc-900 border border-amber-500/40 px-3.5 py-2 text-xs font-bold text-amber-300 transition-all hover:bg-zinc-800 shadow-sm cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4 text-amber-400" />
                  Tabela Zamówień
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const nextMode = !adminEditMode;
                  setAdminEditMode(nextMode);
                  if (!nextMode) {
                    setHistoryFilter('my');
                  }
                }}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-sm cursor-pointer ${
                  adminEditMode 
                    ? 'bg-zinc-900 text-zinc-200 border border-zinc-700 hover:bg-zinc-800' 
                    : 'bg-amber-500 text-black font-black shadow-amber-500/20'
                }`}
              >
                {adminEditMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {adminEditMode ? 'Podgląd klubowicza' : 'Wróć do edycji'}
              </button>

              {adminEditMode && (
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-black transition-all hover:bg-amber-400 shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  <PackagePlus className="h-4 w-4" />
                  Dodaj produkt
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wyszukiwarka i kategorie */}
      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Szukaj odzieży, suplementów, usług..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {filterCategories.map((cat) => {
            const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <div key={cat} className="relative flex items-center shrink-0">
                <button
                  onClick={() => setSelectedCategory(cat)}
                  className={`whitespace-nowrap rounded-xl py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    isEffectiveAdmin && cat !== 'Wszystko' ? 'pl-3.5 pr-8' : 'px-4'
                  } ${
                    isSelected
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                      : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {cat}
                </button>

                {isEffectiveAdmin && cat !== 'Wszystko' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleDeleteCategory(cat);
                    }}
                    title={`Usuń kategorię "${cat}" z paska`}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-zinc-300 hover:bg-rose-600 hover:text-white transition-colors cursor-pointer z-10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stan ładowania */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
          <p className="mt-3 text-sm text-zinc-400">Wczytywanie sklepu...</p>
        </div>
      )}

      {error && (
        <div className="my-8 flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Siatka produktów */}
      {!loading && !error && (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((item, index) => {
              const isClothing = item.category.toLowerCase().includes('odzież') || item.category.toLowerCase().includes('odziez');
              const parsedData = parseProductSizeStocks(item.available_sizes, item.target_gender);
              const hasSizeChart = Boolean(item.size_chart_url);

              const activeGender = selectedProductGenders[item.id] || (parsedData.isDualGender ? 'Męski' : (item.target_gender || 'Unisex'));
              const currentGenderStocks = parsedData.isDualGender
                ? (activeGender === 'Damski' ? parsedData.stocks.Damski : parsedData.stocks.Męski)
                : (item.target_gender === 'Damski' ? parsedData.stocks.Damski : item.target_gender === 'Męski' ? parsedData.stocks.Męski : parsedData.stocks.Unisex);

              const hasSizes = Object.keys(currentGenderStocks).length > 0;
              const currentSelectedSize = selectedProductSizes[item.id] || '';
              const isSizeWarning = sizeWarningProductId === item.id;

              const isFirst = index === 0;
              const isLast = index === filteredProducts.length - 1;

              return (
                <div
                  key={item.id}
                  className={`group flex flex-col justify-between overflow-hidden rounded-2xl border transition-all ${
                    !item.is_active
                      ? 'border-amber-500/50 bg-zinc-900/40 opacity-80'
                      : isSizeWarning
                      ? 'border-rose-500 ring-2 ring-rose-500/50 bg-zinc-900'
                      : 'border-zinc-800/90 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900'
                  }`}
                >
                  <div>
                    <div className="relative h-60 w-full overflow-hidden bg-zinc-950">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-zinc-700">
                          <Dumbbell className="h-12 w-12" />
                        </div>
                      )}

                      <div className="absolute left-3 top-3 flex flex-col gap-1.5 items-start">
                        {item.badge && (
                          <div className="flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-black shadow-lg">
                            <Tag className="h-3 w-3" />
                            {item.badge}
                          </div>
                        )}
                        {!item.is_active && (
                          <div className="flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-lg">
                            <EyeOff className="h-3 w-3" />
                            Ukryty
                          </div>
                        )}
                      </div>

                      {/* Przyciski edycji i zmiany kolejności WYŁĄCZNIE dla aktywnego administratora */}
                      {isEffectiveAdmin && (
                        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-xl bg-black/85 p-1 border border-zinc-700 shadow-xl">
                          <button
                            type="button"
                            disabled={isFirst}
                            onClick={() => handleMoveProduct(item, 'prev')}
                            className="rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="Przesuń produkt w lewo / wyżej"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={isLast}
                            onClick={() => handleMoveProduct(item, 'next')}
                            className="rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="Przesuń produkt w prawo / niżej"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>

                          <div className="h-3 w-[1px] bg-zinc-700 mx-0.5" />

                          <button
                            type="button"
                            onClick={() => handleToggleProductStatus(item)}
                            className="rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white cursor-pointer"
                            title={item.is_active ? 'Ukryj produkt przed klubowiczami' : 'Opublikuj produkt'}
                          >
                            {item.is_active ? <Eye className="h-3.5 w-3.5 text-emerald-400" /> : <EyeOff className="h-3.5 w-3.5 text-zinc-400" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-amber-400 cursor-pointer"
                            title="Edytuj produkt i kolejność"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(item)}
                            className="rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-rose-400 cursor-pointer"
                            title="Usuń z bazy"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                          {item.category}
                        </span>
                        {isEffectiveAdmin && (
                          <span className="text-xs text-zinc-400 font-mono">
                            Łączny magazyn: <strong className={item.stock > 0 ? 'text-zinc-200' : 'text-rose-400'}>{item.stock} szt.</strong>
                          </span>
                        )}
                      </div>

                      <h3 className="mt-1 text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                        {item.name}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm text-zinc-400 leading-relaxed">
                        {item.description || 'Brak opisu.'}
                      </p>

                      {isClothing && (
                        <div className="mt-4 space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                              {parsedData.isDualGender ? 'Dostępne kroje:' : (item.target_gender || 'Unisex')}
                            </span>
                            {hasSizeChart && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSizeChartUrl(item.size_chart_url || null);
                                  setActiveSizeChartTitle(item.name);
                                }}
                                className="flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                              >
                                <Ruler className="h-3.5 w-3.5" />
                                Tabela rozmiarów
                              </button>
                            )}
                          </div>

                          {parsedData.isDualGender && (
                            <div className="flex items-center gap-1.5 pt-1">
                              {(['Męski', 'Damski'] as const).map((gender) => (
                                <button
                                  key={gender}
                                  type="button"
                                  onClick={() => {
                                    setSelectedProductGenders((prev) => ({ ...prev, [item.id]: gender }));
                                    setSelectedProductSizes((prev) => ({ ...prev, [item.id]: '' }));
                                  }}
                                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
                                    activeGender === gender
                                      ? 'bg-amber-500 text-black shadow-sm font-black'
                                      : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800'
                                  }`}
                                >
                                  {gender === 'Męski' ? '👔 Krój Męski' : '👗 Krój Damski'}
                                </button>
                              ))}
                            </div>
                          )}

                          {hasSizes && (
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                  Rozmiar ({activeGender}):
                                </span>
                                {isSizeWarning && (
                                  <span className="text-[10px] font-bold text-rose-400 animate-pulse">
                                    Wybierz dostępny rozmiar!
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(currentGenderStocks).map(([size, stockQty]) => {
                                  const isSelected = currentSelectedSize === size;
                                  const isOutOfStock = stockQty <= 0;

                                  return (
                                    <button
                                      key={size}
                                      type="button"
                                      disabled={isOutOfStock}
                                      onClick={() => {
                                        if (!isOutOfStock) {
                                          setSelectedProductSizes((prev) => ({ ...prev, [item.id]: size }));
                                          setSizeWarningProductId(null);
                                        }
                                      }}
                                      className={`relative rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                                        isOutOfStock
                                          ? 'opacity-35 bg-zinc-900/50 text-zinc-500 border border-zinc-800 line-through cursor-not-allowed'
                                          : isSelected
                                          ? 'bg-amber-500 text-black shadow-sm font-black ring-1 ring-amber-400 cursor-pointer'
                                          : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-zinc-800 cursor-pointer'
                                      }`}
                                      title={isOutOfStock ? `Rozmiar ${size} wyprzedany` : `Na stanie: ${stockQty} szt.`}
                                    >
                                      <span>{size}</span>
                                      <span className={`ml-1 text-[9px] font-mono ${isSelected ? 'text-zinc-900' : isOutOfStock ? 'text-zinc-600' : 'text-amber-400/80'}`}>
                                        {isOutOfStock ? '(0)' : `(${stockQty})`}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-800/80 p-5 pt-4">
                    <div>
                      <span className="text-xs text-zinc-500 block">Cena brutto</span>
                      <p className="text-xl font-black text-white">
                        {Number(item.price).toFixed(2)} <span className="text-xs font-bold text-zinc-400">PLN</span>
                      </p>
                    </div>

                    <button
                      onClick={() => handleAddToCartWithValidation(item)}
                      disabled={item.stock <= 0}
                      className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-black transition-transform hover:bg-amber-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      {item.stock > 0 ? 'Do koszyka' : 'Brak'}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-16 text-center">
              <p className="text-base text-zinc-400">Brak artykułów w tej kategorii.</p>
              <button
                onClick={() => {
                  setSelectedCategory('Wszystko');
                  setSearchQuery('');
                }}
                className="mt-4 rounded-xl bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 cursor-pointer"
              >
                Zresetuj filtry
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal Podglądu Tabeli Rozmiarów */}
      {activeSizeChartUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Ruler className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Tabela rozmiarów: {activeSizeChartTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveSizeChartUrl(null)}
                className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative mt-4 flex-1 overflow-auto rounded-2xl bg-zinc-900/50 p-2 flex items-center justify-center">
              <img
                src={activeSizeChartUrl}
                alt={`Tabela rozmiarów: ${activeSizeChartTitle}`}
                className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain shadow-md"
              />
            </div>

            <div className="mt-4 flex justify-end border-t border-zinc-800 pt-3">
              <button
                type="button"
                onClick={() => setActiveSizeChartUrl(null)}
                className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-400 cursor-pointer"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edycji i Dodawania Produktu */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-hidden">
          <div className="relative w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6 shadow-2xl flex flex-col max-h-[92vh]">
            
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PackagePlus className="h-5 w-5 text-amber-400" />
                {editingProductId ? 'Edycja produktu / usługi' : 'Dodaj nowy produkt / usługę'}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {productModalError && (
              <div className="my-3 flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 shrink-0">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{productModalError}</span>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <input
              type="file"
              ref={sizeChartFileInputRef}
              accept="image/*"
              onChange={handleSizeChartUpload}
              className="hidden"
            />

            <form onSubmit={handleSaveProduct} className="flex-1 flex flex-col overflow-hidden mt-3">
              <div className="flex-1 overflow-y-auto pr-1.5 space-y-4 text-xs">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Nazwa produktu / usługi *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="np. Koszulka Treningowa FORMA MARZEŃ"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold uppercase tracking-wider text-zinc-300">
                        Kategoria *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const nextCustom = !isCustomCategory;
                          setIsCustomCategory(nextCustom);
                          if (nextCustom) {
                            setProductForm({ ...productForm, category: '' });
                          } else {
                            setProductForm({ ...productForm, category: availableCategories[0] || 'Odzież' });
                          }
                        }}
                        className="text-[9px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                      >
                        {isCustomCategory ? 'Lista' : '+ Własna'}
                      </button>
                    </div>

                    {isCustomCategory ? (
                      <input
                        type="text"
                        required
                        placeholder="Kategoria"
                        value={productForm.category}
                        onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                        className="w-full rounded-xl border border-amber-500/50 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                      />
                    ) : (
                      <select
                        value={productForm.category}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setIsCustomCategory(true);
                            setProductForm({ ...productForm, category: '' });
                          } else {
                            setProductForm({ ...productForm, category: e.target.value });
                          }
                        }}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-2.5 py-2.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none cursor-pointer"
                      >
                        {availableCategories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        <option value="__custom__">+ Dodaj inną...</option>
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold uppercase tracking-wider text-zinc-300 mb-1">
                      Cena (PLN) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="np. 149.00"
                      value={productForm.price}
                      onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase tracking-wider text-zinc-300 mb-1 flex items-center gap-1" title="Kolejność w sklepie (np. 1 = pierwszy)">
                      <ArrowUpDown className="h-3 w-3 text-amber-400" />
                      Kolejność
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="np. 1"
                      value={productForm.display_order}
                      onChange={(e) => setProductForm({ ...productForm, display_order: e.target.value })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none font-mono text-center"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-zinc-300 mb-1">
                      Stan magazynowy (łączny)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      readOnly={productForm.category.toLowerCase().includes('odzież') || productForm.category.toLowerCase().includes('odziez')}
                      placeholder="np. 20"
                      value={productForm.stock}
                      onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                      className={`w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none ${
                        (productForm.category.toLowerCase().includes('odzież') || productForm.category.toLowerCase().includes('odziez')) ? 'opacity-75 cursor-not-allowed font-mono' : ''
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase tracking-wider text-zinc-300 mb-1">
                      Odznaka / Badge (opcja)
                    </label>
                    <input
                      type="text"
                      placeholder="np. Bestseller, Nowość"
                      value={productForm.badge}
                      onChange={(e) => setProductForm({ ...productForm, badge: e.target.value })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {(productForm.category.toLowerCase().includes('odzież') || productForm.category.toLowerCase().includes('odziez')) && (
                  <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3.5">
                    <div className="flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-amber-400" />
                      <span className="font-black uppercase tracking-wider text-amber-300 text-xs">
                        Stany Magazynowe Rozmiarów i Warianty
                      </span>
                    </div>

                    <div>
                      <label className="block font-bold uppercase tracking-wider text-zinc-300 mb-1">
                        Płeć / Przeznaczenie
                      </label>
                      <select
                        value={productForm.target_gender}
                        onChange={(e) => setProductForm({ ...productForm, target_gender: e.target.value })}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none cursor-pointer"
                      >
                        <option value="Męski / Damski (do wyboru)">Męski / Damski (do wyboru)</option>
                        <option value="Męski">Męski</option>
                        <option value="Damski">Damski</option>
                        <option value="Unisex">Unisex</option>
                      </select>
                    </div>

                    <div>
                      {productForm.target_gender === 'Męski / Damski (do wyboru)' ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="block font-bold uppercase tracking-wider text-zinc-300">
                              Stany magazynowe per krój:
                            </label>
                            <div className="flex rounded-lg bg-zinc-900 p-0.5 border border-zinc-800">
                              <button
                                type="button"
                                onClick={() => setAdminActiveGenderTab('Męski')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                                  adminActiveGenderTab === 'Męski'
                                    ? 'bg-amber-500 text-black font-black'
                                    : 'text-zinc-400 hover:text-white'
                                }`}
                              >
                                👔 Męski
                              </button>
                              <button
                                type="button"
                                onClick={() => setAdminActiveGenderTab('Damski')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                                  adminActiveGenderTab === 'Damski'
                                    ? 'bg-amber-500 text-black font-black'
                                    : 'text-zinc-400 hover:text-white'
                                }`}
                              >
                                👗 Damski
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {STANDARD_SIZES.map((size) => {
                              const isEnabled = size in productForm.gender_stocks[adminActiveGenderTab];
                              const currentStock = productForm.gender_stocks[adminActiveGenderTab][size] ?? 0;
                              return (
                                <div
                                  key={size}
                                  className={`flex flex-col p-2.5 rounded-xl border transition-all ${
                                    isEnabled
                                      ? 'border-amber-500/50 bg-zinc-900'
                                      : 'border-zinc-800 bg-zinc-950/40 opacity-60'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="flex items-center gap-1.5 font-bold text-xs cursor-pointer text-zinc-200">
                                      <input
                                        type="checkbox"
                                        checked={isEnabled}
                                        onChange={() => toggleSizeInForm(adminActiveGenderTab, size)}
                                        className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500 cursor-pointer"
                                      />
                                      <span>{size}</span>
                                    </label>
                                    {isEnabled && (
                                      <span className={`text-[10px] font-mono font-bold ${currentStock > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {currentStock > 0 ? `${currentStock} szt.` : 'Brak'}
                                      </span>
                                    )}
                                  </div>
                                  {isEnabled && (
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="Ilość"
                                      value={currentStock}
                                      onChange={(e) => updateSizeStockInForm(adminActiveGenderTab, size, parseInt(e.target.value, 10) || 0)}
                                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none font-mono text-center mt-1"
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block font-bold uppercase tracking-wider text-zinc-300">
                              Rozmiary i stany magazynowe:
                            </label>
                            <span className="text-[10px] text-amber-400 font-mono">
                              Razem: {productForm.stock} szt.
                            </span>
                          </div>

                          {(() => {
                            const genderKey = (productForm.target_gender === 'Damski' ? 'Damski' : productForm.target_gender === 'Męski' ? 'Męski' : 'Unisex') as 'Męski' | 'Damski' | 'Unisex';
                            return (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {STANDARD_SIZES.map((size) => {
                                  const isEnabled = size in productForm.gender_stocks[genderKey];
                                  const currentStock = productForm.gender_stocks[genderKey][size] ?? 0;
                                  return (
                                    <div
                                      key={size}
                                      className={`flex flex-col p-2.5 rounded-xl border transition-all ${
                                        isEnabled
                                          ? 'border-amber-500/50 bg-zinc-900'
                                          : 'border-zinc-800 bg-zinc-950/40 opacity-60'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <label className="flex items-center gap-1.5 font-bold text-xs cursor-pointer text-zinc-200">
                                          <input
                                            type="checkbox"
                                            checked={isEnabled}
                                            onChange={() => toggleSizeInForm(genderKey, size)}
                                            className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500 cursor-pointer"
                                          />
                                          <span>{size}</span>
                                        </label>
                                        {isEnabled && (
                                          <span className={`text-[10px] font-mono font-bold ${currentStock > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {currentStock > 0 ? `${currentStock} szt.` : 'Brak'}
                                          </span>
                                        )}
                                      </div>
                                      {isEnabled && (
                                        <input
                                          type="number"
                                          min="0"
                                          placeholder="Ilość"
                                          value={currentStock}
                                          onChange={(e) => updateSizeStockInForm(genderKey, size, parseInt(e.target.value, 10) || 0)}
                                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none font-mono text-center mt-1"
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                        Zdjęcie tabeli rozmiarów (Galeria / Dysk)
                      </label>

                      {productForm.size_chart_url ? (
                        <div className="relative h-32 w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 group">
                          <img
                            src={productForm.size_chart_url}
                            alt="Podgląd tabeli rozmiarów"
                            className="h-full w-full object-contain"
                          />
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => sizeChartFileInputRef.current?.click()}
                              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black shadow hover:bg-amber-400 cursor-pointer"
                            >
                              <Upload className="h-3 w-3" />
                              Zmień tabelę
                            </button>
                            <button
                              type="button"
                              onClick={() => setProductForm({ ...productForm, size_chart_url: '' })}
                              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-rose-500 cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                              Usuń
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => sizeChartFileInputRef.current?.click()}
                          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-900/60 p-4 text-center cursor-pointer hover:border-amber-500 hover:bg-zinc-900 transition-all"
                        >
                          {isProcessingSizeChart ? (
                            <div className="flex flex-col items-center gap-1.5 text-amber-400">
                              <Loader2 className="h-6 w-6 animate-spin" />
                              <span className="text-xs font-semibold">Kompresowanie tabeli...</span>
                            </div>
                          ) : (
                            <>
                              <Ruler className="h-6 w-6 text-amber-400 mb-1" />
                              <span className="text-xs font-bold text-zinc-200">
                                Wybierz zdjęcie tabeli rozmiarów
                              </span>
                              <span className="text-[10px] text-zinc-500 mt-0.5">
                                Pojawi się klubowiczom po kliknięciu "Tabela rozmiarów"
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Zdjęcie artykułu (Galeria / Dysk)
                  </label>

                  {productForm.image_url ? (
                    <div className="relative h-44 w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 group">
                      <Image
                        src={productForm.image_url}
                        alt="Podgląd zdjęcia"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 transition-opacity">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-black shadow-lg hover:bg-amber-400 cursor-pointer"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Zmień z galerii
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductForm({ ...productForm, image_url: '' })}
                          className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg hover:bg-rose-500 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Usuń
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/60 p-6 text-center cursor-pointer hover:border-amber-500 hover:bg-zinc-900 transition-all"
                    >
                      {isProcessingImage ? (
                        <div className="flex flex-col items-center gap-2 text-amber-400">
                          <Loader2 className="h-7 w-7 animate-spin" />
                          <span className="text-xs font-semibold">Kompresowanie grafiki z galerii...</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 mb-2">
                            <ImageIcon className="h-6 w-6" />
                          </div>
                          <span className="text-xs font-bold text-zinc-200">
                            Wybierz zdjęcie z galerii lub zrób aparatem
                          </span>
                          <span className="text-[11px] text-zinc-500 mt-1">
                            Dotknij tutaj, aby otworzyć bibliotekę zdjęć urządzenia
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold uppercase tracking-wider text-zinc-300">
                      Szczegółowy opis artykułu / usługi
                    </label>
                    <span className="text-[10px] text-zinc-500">Powiększone okno edycji</span>
                  </div>
                  <textarea
                    rows={5}
                    placeholder="Wprowadź szczegółowy opis produktu, skład materiału, zasady konserwacji, specyfikację..."
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    className="w-full min-h-[120px] rounded-xl border border-zinc-800 bg-zinc-900 p-3.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none resize-y leading-relaxed"
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="product-active-toggle"
                    checked={productForm.is_active}
                    onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500 cursor-pointer"
                  />
                  <label htmlFor="product-active-toggle" className="font-bold text-zinc-200 cursor-pointer">
                    Produkt aktywny i widoczny dla klubowiczów
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-zinc-800 pt-4 mt-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={savingProduct || isProcessingImage || isProcessingSizeChart}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-400 disabled:opacity-50 cursor-pointer"
                >
                  {savingProduct ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Zapisywanie...
                    </>
                  ) : (
                    'Zapisz artykuł'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Rejestru Zamówień */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-5xl rounded-3xl border border-zinc-800 bg-zinc-950 p-5 sm:p-7 shadow-2xl my-6 flex flex-col max-h-[92vh]">
            
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
                  {isEffectiveAdmin && historyFilter === 'all' ? <FileSpreadsheet className="h-6 w-6" /> : <Receipt className="h-6 w-6" />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    {isEffectiveAdmin && historyFilter === 'all' ? 'Tabela Zamówień Klubowych' : 'Twoja Historia Zamówień'}
                    <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-400">
                      {filteredOrdersHistory.length}
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    {isEffectiveAdmin && historyFilter === 'all' 
                      ? 'Pełny rejestr kupionych pozycji z danymi klubowiczów i statusem wpłat' 
                      : 'Zestawienie Twoich zakupów i opłaconych pakietów'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {isEffectiveAdmin && (
                  <div className="flex items-center rounded-xl bg-zinc-900 p-1 border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setHistoryFilter('all')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        historyFilter === 'all' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Wszystkie w klubie
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryFilter('my')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        historyFilter === 'my' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Moje zakupy
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setIsHistoryOpen(false)}
                  className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 shrink-0">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder={isEffectiveAdmin && historyFilter === 'all' ? "Filtruj tabelę po imieniu, nazwisku, mailu lub produkcie..." : "Szukaj w swoich zamówieniach..."}
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 py-2 pl-9 pr-8 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
                {historySearchQuery && (
                  <button
                    onClick={() => setHistorySearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto pr-1">
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                  <span className="mt-3 text-xs">Pobieranie rejestru zamówień...</span>
                </div>
              ) : filteredOrdersHistory.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/50">
                  <table className="w-full text-left text-xs text-zinc-200 border-collapse">
                    <thead className="bg-zinc-900 text-[11px] font-black uppercase tracking-wider text-zinc-400 border-b border-zinc-800 sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-4">Imię i nazwisko</th>
                        <th className="py-3 px-4">Data zakupu</th>
                        <th className="py-3 px-4">Produkt</th>
                        <th className="py-3 px-4">Kwota</th>
                        <th className="py-3 px-4 text-center">Czy opłacono</th>
                        {isEffectiveAdmin && <th className="py-3 px-4 text-right">Akcja</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {filteredOrdersHistory.map((order) => {
                        const isPaid = 
                          order.status?.toLowerCase() === 'opłacone' || 
                          order.status?.toLowerCase() === 'paid' || 
                          order.status?.toLowerCase() === 'completed';

                        const isCancelled = 
                          order.status?.toLowerCase() === 'anulowano' || 
                          order.status?.toLowerCase() === 'cancelled' || 
                          order.status?.toLowerCase() === 'odrzucone';

                        const formattedDate = order.created_at
                          ? new Date(order.created_at).toLocaleString('pl-PL', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Brak daty';

                        return (
                          <tr key={order.id} className="hover:bg-zinc-800/40 transition-colors">
                            <td className="py-3.5 px-4 align-top">
                              <div className="font-bold text-white text-sm">
                                {order.customer_name || 'Brak danych'}
                              </div>
                              <div className="text-[11px] text-zinc-400 flex flex-col gap-0.5 mt-0.5">
                                {order.customer_email && <span>{order.customer_email}</span>}
                                {order.customer_phone && <span className="font-mono text-zinc-500">{order.customer_phone}</span>}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-zinc-300 font-mono text-[11px]">
                                <Clock className="h-3.5 w-3.5 text-amber-400/80 shrink-0" />
                                {formattedDate}
                              </div>
                              <span className="text-[10px] text-zinc-500 block mt-1 font-mono">
                                #{order.id.slice(0, 8)}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              {order.order_items && order.order_items.length > 0 ? (
                                <div className="space-y-1.5">
                                  {order.order_items.map((it, idx) => (
                                    <div key={it.id || idx} className="flex items-center gap-2">
                                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                                      <span className="font-bold text-zinc-100">{it.product_name}</span>
                                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                                        ×{it.quantity}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-zinc-500 italic">Brak pozycji w rekordzie</span>
                              )}
                              {order.shipping_notes && (
                                <p className="text-[11px] text-amber-400/80 italic mt-1.5 bg-amber-500/5 p-1 rounded border border-amber-500/10">
                                  Uwagi: {order.shipping_notes}
                                </p>
                              )}
                            </td>

                            <td className="py-3.5 px-4 align-top whitespace-nowrap">
                              <span className="font-black text-amber-400 font-mono text-sm">
                                {Number(order.total_amount).toFixed(2)} PLN
                              </span>
                              <span className="block text-[10px] text-zinc-500 uppercase">
                                {order.payment_method === 'Portfel' ? '👛 Portfel' : 'AutoPay Online'}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 align-top text-center whitespace-nowrap">
                              {isPaid ? (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-400">
                                  <CheckCheck className="h-3.5 w-3.5" />
                                  Opłacone
                                </span>
                              ) : isCancelled ? (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-rose-400">
                                  <XCircle className="h-3.5 w-3.5" />
                                  Anulowano
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-amber-400">
                                  <Clock className="h-3.5 w-3.5" />
                                  Oczekuje
                                </span>
                              )}
                            </td>

                            {isEffectiveAdmin && (
                              <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isCancelled ? (
                                    <button
                                      type="button"
                                      onClick={() => handleSetOrderStatus(order.id, 'pending')}
                                      className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-[11px] font-bold text-zinc-200 hover:bg-zinc-700 transition-colors cursor-pointer"
                                      title="Przywróć zamówienie do statusu oczekujące"
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                      Przywróć
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleSetOrderStatus(order.id, isPaid ? 'pending' : 'opłacone')}
                                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-colors cursor-pointer ${
                                          isPaid
                                            ? 'border-zinc-700 bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                                            : 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                        }`}
                                        title={isPaid ? "Kliknij, aby cofnąć wpłatę do oczekujących" : "Kliknij, aby zatwierdzić jako opłacone"}
                                      >
                                        {isPaid ? 'Cofnij wpłatę' : 'Zatwierdź wpłatę'}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleCancelOrder(order.id)}
                                        className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-300 hover:bg-rose-500/25 transition-colors cursor-pointer"
                                        title="Anuluj to zamówienie"
                                      >
                                        <XCircle className="h-3 w-3" />
                                        Anuluj
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-24 text-center">
                  <FileSpreadsheet className="mx-auto h-12 w-12 text-zinc-700" />
                  <p className="mt-3 text-sm text-zinc-300 font-bold">Brak zamówień do wyświetlenia</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {isEffectiveAdmin && historyFilter === 'all' 
                      ? 'W klubie nie ma jeszcze zarejestrowanych zamówień.' 
                      : 'Nie złożyłeś jeszcze żadnego zamówienia na tym koncie.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drawer Koszyka i Realizacji Zamówienia */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div
            className="fixed inset-0 bg-black/75 transition-opacity"
            onClick={() => setIsCartOpen(false)}
          />

          <div className="relative z-10 flex h-[100dvh] w-full max-w-md flex-col bg-zinc-950 border-l border-zinc-800 shadow-2xl overflow-hidden">
            
            <div className="flex items-center justify-between border-b border-zinc-800 p-5 shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-amber-400" />
                <h2 className="text-base font-bold text-white">
                  {checkoutStep === 'cart' ? 'Twój Koszyk' : 'Dane do zamówienia'}
                </h2>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-400">
                  {cartItemCount}
                </span>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 pt-2 shrink-0">
              {orderSuccess && (
                <div className="my-2 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <p className="text-xs font-medium leading-relaxed">
                    {orderSuccessMessage}
                  </p>
                </div>
              )}

              {submitError && (
                <div className="my-2 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-400 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>{submitError}</p>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4">
              {checkoutStep === 'cart' ? (
                <div className="space-y-3">
                  {cart.length > 0 ? (
                    cart.map((item) => (
                      <div
                        key={item.cartItemId}
                        className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3"
                      >
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                          {item.product.image_url ? (
                            <Image
                              src={item.product.image_url}
                              alt={item.product.name}
                              fill
                              unoptimized
                              sizes="56px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-zinc-600">
                              <Dumbbell className="h-6 w-6" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="truncate text-sm font-semibold text-white">
                            {item.product.name}
                          </h4>
                          {(item.selectedSize || item.selectedGender) && (
                            <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-medium">
                              {item.selectedGender && (
                                <span className={item.selectedGender === 'Damski' ? 'text-rose-400' : 'text-blue-400'}>
                                  {item.selectedGender}
                                </span>
                              )}
                              {item.selectedGender && item.selectedSize && <span>•</span>}
                              {item.selectedSize && (
                                <span className="font-bold text-amber-400">
                                  Rozmiar: {item.selectedSize}
                                </span>
                              )}
                            </div>
                          )}
                          <p className="text-xs font-medium text-amber-400 mt-0.5">
                            {Number(item.product.price).toFixed(2)} PLN
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.cartItemId, -1)}
                              className="flex h-6 w-6 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-xs font-bold text-zinc-100">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.cartItemId, 1)}
                              className="flex h-6 w-6 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.cartItemId)}
                          className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="py-16 text-center">
                      <ShoppingBag className="mx-auto h-12 w-12 text-zinc-700" />
                      <p className="mt-3 text-sm text-zinc-500 font-bold">Twój koszyk jest pusty</p>
                    </div>
                  )}
                </div>
              ) : (
                <form id="checkout-form" onSubmit={handleSubmitOrder} className="space-y-3.5">
                  {!isMemberLoggedIn && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-start gap-2">
                      <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>Zakupy w sklepie są dostępne wyłącznie dla zalogowanych klubowiczów.</span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-amber-400" /> Imię i nazwisko *
                      </label>
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1 font-mono">
                        <Lock className="h-2.5 w-2.5" /> Profil klubowicza
                      </span>
                    </div>
                    <input
                      type="text"
                      readOnly
                      required
                      value={formData.customerName}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-3.5 py-2.5 text-sm text-zinc-300 select-none cursor-not-allowed focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-amber-400" /> Numer telefonu *
                      </label>
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1 font-mono">
                        <Lock className="h-2.5 w-2.5" /> Z bazy klubu
                      </span>
                    </div>
                    <input
                      type="tel"
                      readOnly
                      required
                      value={formData.customerPhone}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-3.5 py-2.5 text-sm text-zinc-300 select-none cursor-not-allowed focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-amber-400" /> Adres e-mail *
                      </label>
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1 font-mono">
                        <Lock className="h-2.5 w-2.5" /> Konto klubowe
                      </span>
                    </div>
                    <input
                      type="email"
                      readOnly
                      required
                      value={formData.customerEmail}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-3.5 py-2.5 text-sm text-zinc-300 select-none cursor-not-allowed focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5 mb-1">
                      <FileText className="h-3.5 w-3.5 text-amber-400" /> Uwagi / Termin odbioru w klubie
                    </label>
                    <textarea
                      rows={2}
                      placeholder="np. Odbiór osobisty w recepcji klubu..."
                      value={formData.shippingNotes}
                      onChange={(e) => setFormData({ ...formData, shippingNotes: e.target.value })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none resize-none leading-relaxed"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-amber-400" /> Wybierz metodę płatności
                      </label>
                      <span className="text-[10px] font-mono text-zinc-400">
                        Portfel: <strong className={clientWalletBalance >= cartTotal ? 'text-emerald-400' : 'text-rose-400'}>{clientWalletBalance.toFixed(2)} PLN</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, paymentMethod: 'autopay' })}
                        className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer flex flex-col justify-between ${
                          formData.paymentMethod === 'autopay'
                            ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30'
                            : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CreditCard className={`h-4 w-4 ${formData.paymentMethod === 'autopay' ? 'text-amber-400' : 'text-zinc-400'}`} />
                            <span className="text-xs font-black uppercase tracking-wider text-white">AutoPay</span>
                          </div>
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                            Online
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-2">
                          BLIK, karta płatnicza, Apple Pay i szybki przelew
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, paymentMethod: 'wallet' })}
                        className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer flex flex-col justify-between ${
                          formData.paymentMethod === 'wallet'
                            ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30'
                            : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Wallet className={`h-4 w-4 ${formData.paymentMethod === 'wallet' ? 'text-amber-400' : 'text-zinc-400'}`} />
                            <span className="text-xs font-black uppercase tracking-wider text-white">Mój Portfel</span>
                          </div>
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold font-mono ${
                            clientWalletBalance >= cartTotal
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {clientWalletBalance.toFixed(2)} PLN
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-2">
                          {clientWalletBalance >= cartTotal
                            ? 'Środki zostaną natychmiast pobrane z salda portfela'
                            : 'Niewystarczające środki w portfelu na ten zakup'}
                        </p>
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            <div className="border-t border-zinc-800 bg-zinc-950 p-5 shrink-0 space-y-3 shadow-2xl">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Suma częściowa</span>
                  <span className="font-mono">{cartTotal.toFixed(2)} PLN</span>
                </div>
                <div className="flex justify-between font-bold text-white text-base">
                  <span>Do zapłaty</span>
                  <span className="text-amber-400 font-mono text-lg">{cartTotal.toFixed(2)} PLN</span>
                </div>
              </div>

              {checkoutStep === 'cart' ? (
                <button
                  onClick={() => setCheckoutStep('form')}
                  disabled={cart.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-sm font-black uppercase tracking-wider text-black transition-all hover:bg-amber-400 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Przejdź do zamówienia
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCheckoutStep('cart')}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                  >
                    Wróć
                  </button>
                  <button
                    type="submit"
                    form="checkout-form"
                    disabled={
                      isCheckingOut || 
                      !isMemberLoggedIn || 
                      (formData.paymentMethod === 'wallet' && clientWalletBalance < cartTotal)
                    }
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-sm font-black uppercase tracking-wider text-black transition-all hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                  >
                    {isCheckingOut ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Przetwarzanie...
                      </>
                    ) : formData.paymentMethod === 'wallet' ? (
                      <>
                        <Wallet className="h-4 w-4" />
                        Opłać z portfela ({cartTotal.toFixed(2)} PLN)
                      </>
                    ) : (
                      <>
                        Zatwierdź i zapłać AutoPay
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

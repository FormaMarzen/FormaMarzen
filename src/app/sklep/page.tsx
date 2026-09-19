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
  Lock
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
}

export interface CartItem {
  product: Product;
  quantity: number;
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
  paymentMethod: string;
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
}

const DEFAULT_CATEGORIES: string[] = [
  'Odzież',
  'Suplementy',
  'Akcesoria',
  'Gadżety',
  'Usługi'
];

const INITIAL_PRODUCT_FORM: ProductFormData = {
  name: '',
  category: 'Odzież',
  price: '',
  description: '',
  image_url: '',
  stock: '10',
  badge: '',
  is_active: true,
};

export default function ShopPage() {
  // Wymuszenie aktualizacji Service Workera PWA
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

  // Autoryzacja administratora
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('fm_user_role');
      const storedEmail = (localStorage.getItem('fm_user_email') || '').toLowerCase();
      return storedRole === 'admin' || storedEmail.includes('maciejklaput') || storedEmail.includes('klaput');
    }
    return true;
  });

  const [adminEditMode, setAdminEditMode] = useState<boolean>(true);

  // Filtrowanie i wyszukiwanie w sklepie
  const [selectedCategory, setSelectedCategory] = useState<string>('Wszystko');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Koszyk
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'form'>('cart');
  const [orderSuccess, setOrderSuccess] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Tabela i Rejestr zamówień
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [ordersHistory, setOrdersHistory] = useState<OrderRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'my'>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  // Formularz zamówienia AutoPay
  const [formData, setFormData] = useState<OrderFormData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    shippingNotes: '',
    paymentMethod: 'AutoPay',
  });

  // Modal zarządzania produktem
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductFormData>(INITIAL_PRODUCT_FORM);
  const [isCustomCategory, setIsCustomCategory] = useState<boolean>(false);
  const [savingProduct, setSavingProduct] = useState<boolean>(false);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [productModalError, setProductModalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pobranie danych zalogowanego klubowicza bez możliwości późniejszej edycji
  useEffect(() => {
    const fetchLoggedMemberData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const storedEmail = (typeof window !== 'undefined' ? localStorage.getItem('fm_user_email') : '') || '';
        const authEmail = (user?.email || storedEmail).toLowerCase().trim();

        if (!authEmail) return;

        const { data: clients } = await supabase.from('klienci').select('*');

        if (clients && clients.length > 0) {
          const matched = clients.find((c: any) => {
            const cEmail = (c['E-mail'] || c.email || '').toLowerCase().trim();
            const nazwisko = (c.Nazwisko || c.nazwisko || '').toLowerCase().trim();
            return (authEmail && cEmail === authEmail) || nazwisko.includes('kłaput');
          });

          if (matched) {
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
          customerName: authEmail.includes('klaput') ? 'Maciej Kłaput' : authEmail.split('@')[0],
        }));
      } catch (err) {
        console.error('Błąd pobierania danych klubowicza:', err);
      }
    };

    fetchLoggedMemberData();
  }, []);

  const isMemberLoggedIn = useMemo(() => {
    return Boolean(formData.customerEmail && formData.customerEmail.trim().length > 0);
  }, [formData.customerEmail]);

  // Dynamiczna lista kategorii
  const availableCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set);
  }, [products]);

  const filterCategories = useMemo(() => {
    return ['Wszystko', ...availableCategories];
  }, [availableCategories]);

  // Weryfikacja uprawnień administratora
  useEffect(() => {
    const verifyAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const email = (user.email || '').toLowerCase().trim();
        if (email === 'maciejklaput@gmail.com' || email === 'maciejklaput@icloud.com') {
          setIsAdmin(true);
          localStorage.setItem('fm_user_role', 'admin');
          return;
        }

        const { data: clients } = await supabase.from('klienci').select('*');
        if (clients && clients.length > 0) {
          const matched = clients.find((c: any) => {
            const cEmail = (c['E-mail'] || c.email || '').toLowerCase().trim();
            const nazwisko = (c.Nazwisko || c.nazwisko || '').toLowerCase().trim();
            return (email && cEmail === email) || nazwisko.includes('kłaput');
          });

          if (matched) {
            setIsAdmin(true);
            localStorage.setItem('fm_user_role', 'admin');
          }
        }
      } catch (e) {
        console.error('Weryfikacja admina:', e);
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

  // Pobieranie rejestru zamówień z blokadą dla zwykłych klubowiczów
  const fetchOrderHistory = async () => {
    try {
      setHistoryLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const currentEmail = (
        user?.email || 
        formData.customerEmail || 
        (typeof window !== 'undefined' ? localStorage.getItem('fm_user_email') : '') || 
        ''
      ).toLowerCase().trim();

      let query = supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });

      if (!isAdmin || historyFilter === 'my') {
        if (!currentEmail) {
          setOrdersHistory([]);
          setHistoryLoading(false);
          return;
        }
        query = query.eq('customer_email', currentEmail);
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
  }, [isHistoryOpen, historyFilter]);

  // Zmiana statusu opłacenia zamówienia przez administratora
  const handleToggleOrderStatus = async (orderId: string, currentStatus: string) => {
    if (!isAdmin) return;
    const isCurrentlyPaid = currentStatus?.toLowerCase() === 'opłacone' || currentStatus?.toLowerCase() === 'paid';
    const newStatus = isCurrentlyPaid ? 'oczekuje' : 'opłacone';

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
      alert('Nie udało się zmienić statusu: ' + (err.message || 'Błąd zapisu w bazie'));
    }
  };

  // Filtrowanie listy zamówień w tabeli
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

  // Obsługa pamięci koszyka
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
    } catch (e) {
      console.error('Błąd zapisu koszyka:', e);
    }
  }, [cart]);

  // Filtrowanie produktów
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      if (!isAdmin || !adminEditMode) {
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
  }, [products, selectedCategory, searchQuery, isAdmin, adminEditMode]);

  // Akcje koszyka
  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prevCart, { product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  }, [cart]);

  // Zapis zamówienia z obsługą AutoPay
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!isMemberLoggedIn) {
      setSubmitError('Zakupy są dostępne wyłącznie dla zalogowanych klubowiczów. Zaloguj się w aplikacji.');
      return;
    }

    if (!formData.customerName.trim() || !formData.customerEmail.trim()) {
      setSubmitError('Nie znaleziono wymaganych danych profilu klubowicza.');
      return;
    }

    try {
      setIsCheckingOut(true);

      const orderPayload = {
        customer_name: formData.customerName.trim(),
        customer_email: formData.customerEmail.trim(),
        customer_phone: formData.customerPhone.trim() || '-',
        shipping_notes: formData.shippingNotes.trim(),
        payment_method: 'AutoPay',
        total_amount: cartTotal,
        status: 'oczekuje'
      };

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([orderPayload])
        .select()
        .single();

      if (orderError || !orderData) {
        throw new Error(orderError?.message || 'Błąd zapisu rekordu zamówienia w bazie.');
      }

      const orderItems = cart.map((item) => ({
        order_id: orderData.id,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw new Error(itemsError.message);

      setOrderSuccess(true);
      setCart([]);
      localStorage.removeItem('fm_shop_cart');
      setCheckoutStep('cart');
      setFormData((prev) => ({
        ...prev,
        shippingNotes: '',
      }));

      setTimeout(() => {
        setOrderSuccess(false);
        setIsCartOpen(false);
      }, 3500);

    } catch (err: any) {
      console.error('Błąd zamówienia:', err);
      const exactError = err?.message || (err?.error_description) || 'Wystąpił problem z bazą danych.';
      setSubmitError(`Błąd zamówienia: ${exactError}`);
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Bezpieczne usuwanie kategorii
  const handleDeleteCategory = async (catToDelete: string) => {
    if (catToDelete === 'Wszystko') {
      alert('Tej kategorii systemowej nie można usunąć.');
      return;
    }

    const fallbackCat = DEFAULT_CATEGORIES[0] || 'Odzież';
    const confirmDelete = window.confirm(
      `Czy na pewno chcesz usunąć kategorię "${catToDelete}"? Produkty z tej kategorii zostaną bezpiecznie przypisane do kategorii "${fallbackCat}".`
    );
    if (!confirmDelete) return;

    try {
      setLoading(true);
      const { error: updateErr } = await supabase
        .from('products')
        .update({ category: fallbackCat, updated_at: new Date().toISOString() })
        .eq('category', catToDelete);

      if (updateErr) throw updateErr;

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

  // Obsługa zdjęcia z galerii lub dysku urządzenia
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    setProductModalError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 900;
        const MAX_HEIGHT = 900;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setProductForm((prev) => ({ ...prev, image_url: compressedDataUrl }));
        }
        setIsProcessingImage(false);
      };
      img.onerror = () => {
        setProductModalError('Nie udało się przetworzyć pliku graficznego.');
        setIsProcessingImage(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setProductModalError('Błąd podczas odczytu pliku z pamięci urządzenia.');
      setIsProcessingImage(false);
    };
    reader.readAsDataURL(file);
  };

  // Obsługa modalu produktu
  const handleOpenAddModal = () => {
    setEditingProductId(null);
    setProductForm(INITIAL_PRODUCT_FORM);
    setIsCustomCategory(false);
    setProductModalError(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProductId(product.id);
    const hasCategoryInList = availableCategories.includes(product.category);
    setIsCustomCategory(!hasCategoryInList);
    setProductForm({
      name: product.name,
      category: product.category || 'Odzież',
      price: product.price.toString(),
      description: product.description || '',
      image_url: product.image_url || '',
      stock: product.stock.toString(),
      badge: product.badge || '',
      is_active: product.is_active,
    });
    setProductModalError(null);
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductModalError(null);

    const priceNum = parseFloat(productForm.price.replace(',', '.'));
    const stockNum = parseInt(productForm.stock, 10);
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

      const payload = {
        name: productForm.name.trim(),
        category: finalCategory,
        price: priceNum,
        description: productForm.description.trim(),
        image_url: productForm.image_url.trim(),
        stock: stockNum,
        badge: productForm.badge.trim() ? productForm.badge.trim() : null,
        is_active: productForm.is_active,
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
              {isAdmin && (
                <span className="flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-400 border border-amber-500/30">
                  <ShieldCheck className="h-3 w-3" />
                  Admin
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">FORMA MARZEŃ Official Merch & Supplements</p>
          </div>
        </div>

        {/* Przyciski operacyjne: Tabela zamówień + Koszyk */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              if (isAdmin) setHistoryFilter('all');
              setIsHistoryOpen(true);
            }}
            className="relative flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-zinc-200 ring-1 ring-zinc-800 transition-all hover:bg-zinc-800 hover:text-white active:scale-95 cursor-pointer"
            aria-label="Rejestr zamówień"
            title={isAdmin ? "Tabela wszystkich zamówień klubowiczów" : "Twoja historia zakupów"}
          >
            {isAdmin ? <FileSpreadsheet className="h-5 w-5 text-amber-400" /> : <History className="h-5 w-5 text-amber-400" />}
            <span className="hidden sm:inline">{isAdmin ? 'Tabela zamówień' : 'Zamówienia'}</span>
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

      {/* Złoty Panel Administratora */}
      {isAdmin && (
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
                    ? 'Tryb edycji aktywny – pełne zarządzanie cenami, kategoriami, stanem, publikacją i zamówieniami' 
                    : 'Podgląd klubowicza aktywny – widzisz sklep dokładnie tak jak klient'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
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

              <button
                type="button"
                onClick={() => setAdminEditMode(!adminEditMode)}
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
                    isAdmin && adminEditMode && cat !== 'Wszystko' ? 'pl-3.5 pr-7' : 'px-4'
                  } ${
                    isSelected
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                      : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {cat}
                </button>

                {isAdmin && adminEditMode && cat !== 'Wszystko' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCategory(cat);
                    }}
                    title={`Usuń kategorię "${cat}"`}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-black/40 text-zinc-300 hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-2.5 w-2.5" />
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
            filteredProducts.map((item) => (
              <div
                key={item.id}
                className={`group flex flex-col justify-between overflow-hidden rounded-2xl border transition-all ${
                  !item.is_active
                    ? 'border-amber-500/50 bg-zinc-900/40 opacity-80'
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

                    {/* Narzędzia edycji na karcie produktu */}
                    {isAdmin && adminEditMode && (
                      <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-xl bg-black/85 p-1.5 border border-zinc-700 shadow-xl">
                        <button
                          type="button"
                          onClick={() => handleToggleProductStatus(item)}
                          className="rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white cursor-pointer"
                          title={item.is_active ? 'Ukryj produkt przed klubowiczami' : 'Opublikuj produkt'}
                        >
                          {item.is_active ? <Eye className="h-4 w-4 text-emerald-400" /> : <EyeOff className="h-4 w-4 text-zinc-400" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          className="rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-amber-400 cursor-pointer"
                          title="Edytuj produkt"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(item)}
                          className="rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-rose-400 cursor-pointer"
                          title="Usuń z bazy"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        {item.category}
                      </span>
                      {isAdmin && adminEditMode && (
                        <span className="text-xs text-zinc-400 font-mono">
                          Magazyn: <strong className={item.stock > 0 ? 'text-zinc-200' : 'text-rose-400'}>{item.stock} szt.</strong>
                        </span>
                      )}
                    </div>

                    <h3 className="mt-1 text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                      {item.name}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm text-zinc-400 leading-relaxed">
                      {item.description || 'Brak opisu.'}
                    </p>
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
                    onClick={() => addToCart(item)}
                    disabled={item.stock <= 0}
                    className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-black transition-transform hover:bg-amber-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    {item.stock > 0 ? 'Do koszyka' : 'Brak'}
                  </button>
                </div>
              </div>
            ))
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

      {/* Modal Edycji i Dodawania Produktu */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
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
              <div className="my-4 flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
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

            <form onSubmit={handleSaveProduct} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-zinc-300 mb-1">
                  Nazwa produktu / usługi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="np. Analiza Składu Ciała"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
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
                      className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                    >
                      {isCustomCategory ? 'Wybierz z listy' : '+ Wpisz własną'}
                    </button>
                  </div>

                  {isCustomCategory ? (
                    <input
                      type="text"
                      required
                      placeholder="np. Usługi, Pakiety..."
                      value={productForm.category}
                      onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                      className="w-full rounded-xl border border-amber-500/50 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
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
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none cursor-pointer"
                    >
                      {availableCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="__custom__">+ Dodaj inną kategorię...</option>
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
                    placeholder="np. 129.00"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-zinc-300 mb-1">
                    Stan magazynowy (szt.) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="np. 25"
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
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

              {/* Zdjęcie artykułu wyłącznie z pamięci urządzenia */}
              <div>
                <label className="block font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                  Zdjęcie artykułu (Galeria / Dysk)
                </label>

                {productForm.image_url ? (
                  <div className="relative h-48 w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 group">
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

              {/* Powiększone okno opisu */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold uppercase tracking-wider text-zinc-300">
                    Szczegółowy opis artykułu / usługi
                  </label>
                  <span className="text-[10px] text-zinc-500">Powiększone okno edycji</span>
                </div>
                <textarea
                  rows={8}
                  placeholder="Wprowadź szczegółowy opis produktu, zakres sesji treningowej, specyfikację, korzyści, zasady realizacji..."
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full min-h-[180px] rounded-xl border border-zinc-800 bg-zinc-900 p-3.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none resize-y leading-relaxed"
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

              <div className="flex items-center justify-end gap-2.5 border-t border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={savingProduct || isProcessingImage}
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
                  {isAdmin ? <FileSpreadsheet className="h-6 w-6" /> : <Receipt className="h-6 w-6" />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    {isAdmin && historyFilter === 'all' ? 'Tabela Zamówień Klubowych' : 'Twoja Historia Zamówień'}
                    <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-400">
                      {filteredOrdersHistory.length}
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    {isAdmin && historyFilter === 'all' 
                      ? 'Pełny rejestr kupionych pozycji z danymi klubowiczów i statusem wpłat' 
                      : 'Zestawienie Twoich zakupów i opłaconych pakietów'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {isAdmin && (
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

            {/* Wyszukiwarka w tabeli zamówień */}
            <div className="mt-4 shrink-0">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder={isAdmin ? "Filtruj tabelę po imieniu, nazwisku, mailu lub produkcie..." : "Szukaj w swoich zamówieniach..."}
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

            {/* Tabela zamówień */}
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
                        {isAdmin && <th className="py-3 px-4 text-right">Akcja</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {filteredOrdersHistory.map((order) => {
                        const isPaid = order.status?.toLowerCase() === 'opłacone' || 
                                       order.status?.toLowerCase() === 'paid' || 
                                       order.status?.toLowerCase() === 'completed';

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
                                AutoPay Online
                              </span>
                            </td>

                            <td className="py-3.5 px-4 align-top text-center whitespace-nowrap">
                              {isPaid ? (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-400">
                                  <CheckCheck className="h-3.5 w-3.5" />
                                  Opłacone
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-amber-400">
                                  <Clock className="h-3.5 w-3.5" />
                                  Oczekuje
                                </span>
                              )}
                            </td>

                            {isAdmin && (
                              <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleToggleOrderStatus(order.id, order.status)}
                                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-colors cursor-pointer ${
                                    isPaid
                                      ? 'border-zinc-700 bg-zinc-800/80 text-zinc-400 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30'
                                      : 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                  }`}
                                  title={isPaid ? "Kliknij, aby cofnąć status na oczekujące" : "Kliknij, aby zatwierdzić jako opłacone"}
                                >
                                  {isPaid ? 'Cofnij wpłatę' : 'Zatwierdź wpłatę'}
                                </button>
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
                    {isAdmin && historyFilter === 'all' 
                      ? 'W klubie nie ma jeszcze zarejestrowanych zamówień.' 
                      : 'Nie złożyłeś jeszcze żadnego zamówienia na tym koncie.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drawer Koszyka i Realizacji Zamówienia (Pełna wysokość bez ucinania) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div
            className="fixed inset-0 bg-black/75 transition-opacity"
            onClick={() => setIsCartOpen(false)}
          />

          <div className="relative z-10 flex h-[100dvh] w-full max-w-md flex-col bg-zinc-950 border-l border-zinc-800 shadow-2xl overflow-hidden">
            
            {/* Nagłówek Drawera */}
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

            {/* Komunikaty */}
            <div className="px-5 pt-2 shrink-0">
              {orderSuccess && (
                <div className="my-2 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <p className="text-xs font-medium">
                    Zamówienie zostało zapisane! Przekierowywanie do płatności AutoPay...
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

            {/* Treść przewijana (Krok 1: Koszyk, Krok 2: Formularz z zablokowanymi danymi) */}
            <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4">
              {checkoutStep === 'cart' ? (
                <div className="space-y-3">
                  {cart.length > 0 ? (
                    cart.map(({ product, quantity }) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3"
                      >
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                          {product.image_url ? (
                            <Image
                              src={product.image_url}
                              alt={product.name}
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
                            {product.name}
                          </h4>
                          <p className="text-xs font-medium text-amber-400">
                            {Number(product.price).toFixed(2)} PLN
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(product.id, -1)}
                              className="flex h-6 w-6 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-xs font-bold text-zinc-100">{quantity}</span>
                            <button
                              onClick={() => updateQuantity(product.id, 1)}
                              className="flex h-6 w-6 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={() => removeFromCart(product.id)}
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

                  {/* Imię i nazwisko (Zablokowane do edycji) */}
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

                  {/* Numer telefonu (Zablokowany do edycji) */}
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

                  {/* E-mail (Zablokowany do edycji) */}
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

                  {/* Edytowalne uwagi klubowicza */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5 mb-1">
                      <FileText className="h-3.5 w-3.5 text-amber-400" /> Uwagi / Termin realizacji / Rozmiar
                    </label>
                    <textarea
                      rows={2}
                      placeholder="np. Odbiór w recepcji klubu / preferowany termin usługi..."
                      value={formData.shippingNotes}
                      onChange={(e) => setFormData({ ...formData, shippingNotes: e.target.value })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none resize-none leading-relaxed"
                    />
                  </div>

                  {/* Kafelek płatności AutoPay bez rozbijania na BLIK/Karta */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-amber-400" /> Metoda płatności
                      </label>
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                        Bramka AutoPay
                      </span>
                    </div>
                    
                    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex items-center justify-between gap-3 shadow-inner">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                          <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Szybka płatność online AutoPay</p>
                          <p className="text-[10px] text-zinc-300">Wybór formy (BLIK, karta, przelew) nastąpi na bramce</p>
                        </div>
                      </div>
                      <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-400 border border-amber-500/30 shrink-0">
                        AutoPay S.A.
                      </span>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Dolna belka z podsumowaniem i przyciskami (Zawsze widoczna bez ucinania) */}
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
                    disabled={isCheckingOut || !isMemberLoggedIn}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-xs font-black uppercase tracking-wider text-black transition-all hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                  >
                    {isCheckingOut ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Przetwarzanie...
                      </>
                    ) : (
                      <>
                        Zatwierdź i przejdź do AutoPay
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

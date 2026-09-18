'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  CreditCard
} from 'lucide-react';

export interface Product {
  id: string;
  name: string;
  category: 'Odzież' | 'Suplementy' | 'Akcesoria' | 'Gadżety';
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

interface OrderFormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingNotes: string;
  paymentMethod: 'blik' | 'karta';
}

const CATEGORIES = [
  'Wszystko',
  'Odzież',
  'Suplementy',
  'Akcesoria',
  'Gadżety'
];

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('Wszystko');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'form'>('cart');
  const [orderSuccess, setOrderSuccess] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [formData, setFormData] = useState<OrderFormData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    shippingNotes: '',
    paymentMethod: 'blik',
  });

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setProducts(data || []);
    } catch (err: unknown) {
      console.error('Błąd podczas pobierania produktów:', err);
      setError('Nie udało się pobrać listy produktów. Spróbuj odświeżyć stronę.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('fm_shop_cart');
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
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

  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const matchesCategory =
        selectedCategory === 'Wszystko' || item.category === selectedCategory;
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

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
    return cart.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  }, [cart]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!formData.customerName.trim() || !formData.customerPhone.trim() || !formData.customerEmail.trim()) {
      setSubmitError('Wypełnij wszystkie wymagane pola kontaktowe.');
      return;
    }

    try {
      setIsCheckingOut(true);

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            customer_name: formData.customerName.trim(),
            customer_email: formData.customerEmail.trim(),
            customer_phone: formData.customerPhone.trim(),
            shipping_notes: formData.shippingNotes.trim(),
            payment_method: formData.paymentMethod,
            total_amount: cartTotal,
            status: 'pending'
          }
        ])
        .select()
        .single();

      if (orderError || !orderData) {
        throw new Error(orderError?.message || 'Błąd zapisu zamówienia.');
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

      if (itemsError) {
        throw new Error(itemsError.message);
      }

      setOrderSuccess(true);
      setCart([]);
      localStorage.removeItem('fm_shop_cart');
      setCheckoutStep('cart');
      setFormData({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        shippingNotes: '',
        paymentMethod: 'blik',
      });

      setTimeout(() => {
        setOrderSuccess(false);
        setIsCartOpen(false);
      }, 3500);

    } catch (err: unknown) {
      console.error('Błąd podczas finalizacji zamówienia:', err);
      setSubmitError('Wystąpił problem podczas składania zamówienia. Spróbuj ponownie.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-24">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                Sklep Klubowy
              </h1>
              <p className="text-xs text-zinc-400">FORMA MARZEŃ Official Merch & Supplements</p>
            </div>
          </div>

          <button
            onClick={() => {
              setCheckoutStep('cart');
              setIsCartOpen(true);
            }}
            className="relative flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 ring-1 ring-zinc-800 transition-all hover:bg-zinc-800 hover:text-white"
            aria-label="Otwórz koszyk"
          >
            <ShoppingBag className="h-5 w-5 text-amber-400" />
            <span className="hidden sm:inline">Koszyk</span>
            {cartItemCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-black">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Szukaj odzieży, suplementów, akcesoriów..."
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
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                    : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            <p className="mt-3 text-sm text-zinc-400">Pobieranie oferty z bazy klubu...</p>
          </div>
        )}

        {error && (
          <div className="my-8 flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((item) => (
                <div
                  key={item.id}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/50 transition-all hover:border-zinc-700 hover:bg-zinc-900"
                >
                  <div>
                    <div className="relative h-56 w-full overflow-hidden bg-zinc-950">
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
                      {item.badge && (
                        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-md bg-amber-500/90 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-black backdrop-blur-sm">
                          <Tag className="h-3 w-3" />
                          {item.badge}
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <span className="text-xs font-medium uppercase tracking-wider text-amber-400/90">
                        {item.category}
                      </span>
                      <h3 className="mt-1 text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                        {item.name}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-400 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-800/60 p-5 pt-4">
                    <div>
                      <span className="text-xs text-zinc-500">Cena brutto</span>
                      <p className="text-xl font-extrabold text-white">
                        {Number(item.price).toFixed(2)} <span className="text-sm font-semibold text-zinc-400">PLN</span>
                      </p>
                    </div>

                    <button
                      onClick={() => addToCart(item)}
                      disabled={item.stock <= 0}
                      className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-black transition-transform hover:bg-amber-400 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="h-4 w-4" />
                      {item.stock > 0 ? 'Do koszyka' : 'Brak na stanie'}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-16 text-center">
                <p className="text-base text-zinc-400">Brak artykułów w wybranej kategorii.</p>
                <button
                  onClick={() => {
                    setSelectedCategory('Wszystko');
                    setSearchQuery('');
                  }}
                  className="mt-4 rounded-xl bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
                >
                  Zresetuj filtry
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsCartOpen(false)}
          />

          <div className="relative z-10 flex h-full w-full max-w-md flex-col justify-between border-l border-zinc-800 bg-zinc-950 p-6 shadow-2xl sm:p-8">
            <div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-amber-400" />
                  <h2 className="text-lg font-bold text-white">
                    {checkoutStep === 'cart' ? 'Twój Koszyk' : 'Dane do zamówienia'}
                  </h2>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-400">
                    {cartItemCount}
                  </span>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {orderSuccess && (
                <div className="my-4 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium">
                    Zamówienie zostało zapisane w bazie! Przekierowywanie do płatności...
                  </p>
                </div>
              )}

              {submitError && (
                <div className="my-4 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-400 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>{submitError}</p>
                </div>
              )}

              {checkoutStep === 'cart' && (
                <div className="mt-4 max-h-[55vh] space-y-4 overflow-y-auto pr-1">
                  {cart.length > 0 ? (
                    cart.map(({ product, quantity }) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3.5"
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
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(product.id, -1)}
                              className="flex h-6 w-6 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-xs font-bold text-zinc-100">{quantity}</span>
                            <button
                              onClick={() => updateQuantity(product.id, 1)}
                              className="flex h-6 w-6 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={() => removeFromCart(product.id)}
                          className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center">
                      <ShoppingBag className="mx-auto h-10 w-10 text-zinc-700" />
                      <p className="mt-3 text-sm text-zinc-500">Twój koszyk jest pusty</p>
                    </div>
                  )}
                </div>
              )}

              {checkoutStep === 'form' && (
                <form id="checkout-form" onSubmit={handleSubmitOrder} className="mt-4 max-h-[55vh] space-y-3.5 overflow-y-auto pr-1">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-1">
                      <User className="h-3.5 w-3.5 text-amber-400" /> Imię i nazwisko *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="np. Jan Kowalski"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-1">
                      <Phone className="h-3.5 w-3.5 text-amber-400" /> Numer telefonu *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+48 000 000 000"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-1">
                      <Mail className="h-3.5 w-3.5 text-amber-400" /> Adres e-mail *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="twoj@email.pl"
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-1">
                      <FileText className="h-3.5 w-3.5 text-amber-400" /> Uwagi / Rozmiar / Odbiór
                    </label>
                    <textarea
                      rows={2}
                      placeholder="np. Odbiór osobisty w klubie / Rozmiar L"
                      value={formData.shippingNotes}
                      onChange={(e) => setFormData({ ...formData, shippingNotes: e.target.value })}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-amber-400" /> Metoda płatności
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, paymentMethod: 'blik' })}
                        className={`rounded-xl border py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
                          formData.paymentMethod === 'blik'
                            ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                            : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        BLIK
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, paymentMethod: 'karta' })}
                        className={`rounded-xl border py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
                          formData.paymentMethod === 'karta'
                            ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                            : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        Karta / Online
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-zinc-800 pt-4">
                <div className="mb-4 space-y-1.5 text-sm">
                  <div className="flex justify-between text-zinc-400">
                    <span>Suma częściowa</span>
                    <span>{cartTotal.toFixed(2)} PLN</span>
                  </div>
                  <div className="flex justify-between font-bold text-white text-base">
                    <span>Do zapłaty</span>
                    <span className="text-amber-400">{cartTotal.toFixed(2)} PLN</span>
                  </div>
                </div>

                {checkoutStep === 'cart' ? (
                  <button
                    onClick={() => setCheckoutStep('form')}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-sm font-bold uppercase tracking-wider text-black transition-all hover:bg-amber-400 active:scale-[0.99]"
                  >
                    Przejdź do zamówienia
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCheckoutStep('cart')}
                      className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:bg-zinc-800"
                    >
                      Wróć
                    </button>
                    <button
                      type="submit"
                      form="checkout-form"
                      disabled={isCheckingOut}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-sm font-bold uppercase tracking-wider text-black transition-all hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50"
                    >
                      {isCheckingOut ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Zapisywanie...
                        </>
                      ) : (
                        <>
                          Zatwierdź i zapłać
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

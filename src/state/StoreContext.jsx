import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { showcaseProducts } from "../data/showcaseCatalog";
import { fetchProductCatalog, isCachedProduct, isRetailProductId } from "../data/productApi";
import { applySpotlightPricing, getSpotlightCycle, selectSpotlightProducts } from "../data/homeSpotlight";

const StoreContext = createContext(undefined);

// Keep existing storage keys so the Vemba rebrand preserves saved shopping data.
const STORAGE_KEYS = {
  cart: "aurel-store:cart",
  wishlist: "aurel-store:wishlist",
  products: "aurel-store:products:v2",
};

const localProducts = showcaseProducts;
const localProductIds = new Set(localProducts.map((product) => String(product.id)));
const isKnownProductId = (id) => localProductIds.has(id) || isRetailProductId(id);

function readStorage(key, fallback) {
  if (typeof window === "undefined") return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Browsing modes that disable storage should not make the shop unusable.
  }
}

function normalizeOption(value) {
  if (value == null || value === "") return null;
  if (typeof value === "object") {
    const optionValue = value.name ?? value.value ?? value.id;
    return optionValue == null ? null : String(optionValue);
  }
  return String(value);
}

function normalizeQuantity(value, fallback = 1) {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? Math.floor(quantity) : fallback;
}

function lineMatches(item, productId, color, size) {
  return (
    item.productId === productId &&
    normalizeOption(item.color) === normalizeOption(color) &&
    normalizeOption(item.size) === normalizeOption(size)
  );
}

function sanitizeCart(value) {
  if (!Array.isArray(value)) return [];

  return value.reduce((cart, item) => {
    if (!item || typeof item !== "object") return cart;

    const rawProductId = item.productId ?? item.id;
    if (rawProductId == null) return cart;

    const productId = String(rawProductId);
    const quantity = normalizeQuantity(item.quantity, 1);
    // Remote IDs must survive restoration while their catalog is still loading.
    if (!isKnownProductId(productId) || quantity <= 0) return cart;

    const normalizedItem = {
      productId,
      quantity,
      color: normalizeOption(item.color),
      size: normalizeOption(item.size),
    };
    const existingIndex = cart.findIndex((line) =>
      lineMatches(line, productId, normalizedItem.color, normalizedItem.size),
    );

    if (existingIndex >= 0) {
      cart[existingIndex] = {
        ...cart[existingIndex],
        quantity: cart[existingIndex].quantity + quantity,
      };
    } else {
      cart.push(normalizedItem);
    }

    return cart;
  }, []);
}

function sanitizeWishlist(value) {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map((entry) => {
          if (entry && typeof entry === "object") return entry.productId ?? entry.id;
          return entry;
        })
        .filter((id) => id != null)
        .map(String)
        .filter(isKnownProductId),
    ),
  ];
}

function normalizeCartInput(input, quantity, color, size) {
  if (input && typeof input === "object") {
    return {
      productId: String(input.productId ?? input.id ?? ""),
      quantity: normalizeQuantity(input.quantity ?? quantity, 1),
      color: normalizeOption(input.color ?? color),
      size: normalizeOption(input.size ?? size),
    };
  }

  return {
    productId: input == null ? "" : String(input),
    quantity: normalizeQuantity(quantity, 1),
    color: normalizeOption(color),
    size: normalizeOption(size),
  };
}

function parsePrice(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const price = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(price) ? price : 0;
}

function presentAsVembaProduct(product) {
  const supplierName = (product.sourceName || product.retailer || "").trim();
  const sourceLabel = supplierName.toLocaleLowerCase();
  const isManufacturerBrand = sourceLabel === "keychron";
  const name = String(product.name || "");
  const displayName = sourceLabel && !isManufacturerBrand && name.toLocaleLowerCase().startsWith(`${sourceLabel} `)
    ? name.slice(supplierName.length).trim()
    : name;
  const originalBrand = String(product.eyebrow || "").trim();
  const displayBrand = originalBrand && (isManufacturerBrand || originalBrand.toLocaleLowerCase() !== sourceLabel)
    ? originalBrand
    : String(product.category || "Vemba collection").replace(/-/g, " ");
  const rawDescription = String(product.description || "");
  const displayDescription = supplierName && !isManufacturerBrand
    && rawDescription.toLocaleLowerCase().startsWith(`${sourceLabel} `)
    ? rawDescription.slice(supplierName.length).trim()
    : rawDescription;
  const sourceCleanDescription = sourceLabel === "headphones.com"
    ? displayDescription.replace(/\.com(?=\.|$)/gi, "")
    : displayDescription;
  const description = sourceCleanDescription
    .replace(/\s*listed by (?:independent )?[^.]+\.?/gi, "")
    .replace(/reference price is for:/gi, "Selected option:");
  const details = Array.isArray(product.details)
    ? product.details
      .map((detail) => String(detail)
        .replace(/^Retailer SKU:/i, "SKU:")
        .replace(/^Listed variant:/i, "Selected option:"))
      .filter((detail) => isManufacturerBrand || !/^Brand:\s*/i.test(detail) || detail.slice(detail.indexOf(":") + 1).trim().toLocaleLowerCase() !== sourceLabel)
      .map((detail) => detail.replace(/retailer product photo/gi, "product photo"))
    : [];

  return {
    ...product,
    name: displayName,
    eyebrow: displayBrand,
    displayBrand,
    description,
    details,
    shippingInformation: "Vemba delivery details will be available when checkout opens.",
    returnPolicy: "Vemba return details will be published before checkout opens.",
  };
}

export function StoreProvider({ children }) {
  const [remoteProducts, setRemoteProducts] = useState(() => {
    const cached = readStorage(STORAGE_KEYS.products, []);
    return Array.isArray(cached) ? cached.filter(isCachedProduct) : [];
  });
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [spotlightCycle, setSpotlightCycle] = useState(getSpotlightCycle);
  const baseProducts = useMemo(() => [...new Map(
    [...localProducts, ...remoteProducts].map((product) => {
      const storefrontProduct = presentAsVembaProduct(product);
      return [storefrontProduct.id, storefrontProduct];
    }),
  ).values()], [remoteProducts]);
  const spotlightSelection = useMemo(
    () => selectSpotlightProducts(baseProducts, spotlightCycle.cycleIndex),
    [baseProducts, spotlightCycle.cycleIndex],
  );
  const products = useMemo(
    () => applySpotlightPricing(baseProducts, spotlightSelection, spotlightCycle.endsAt),
    [baseProducts, spotlightSelection, spotlightCycle.endsAt],
  );
  const productById = useMemo(
    () => new Map(products.map((product) => [String(product.id), product])),
    [products],
  );
  const spotlightItems = useMemo(
    () => spotlightSelection.map((item) => ({ ...item, product: productById.get(item.id) })),
    [spotlightSelection, productById],
  );
  const getProduct = useCallback((slugOrId) => {
    const key = String(slugOrId ?? "").trim().toLowerCase();
    return productById.get(key) || products.find((product) => product.slug.toLowerCase() === key);
  }, [productById, products]);
  const reloadProducts = useCallback(() => {
    setProductsLoading(true);
    setProductsError(null);
    setRequestVersion((version) => version + 1);
  }, []);
  const [cart, setCart] = useState(() =>
    sanitizeCart(readStorage(STORAGE_KEYS.cart, [])),
  );
  const [wishlist, setWishlist] = useState(() =>
    sanitizeWishlist(readStorage(STORAGE_KEYS.wishlist, [])),
  );
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastState, setToastState] = useState(null);

  const toast = toastState?.message ?? null;

  // Keep offers current on every route, including bags left open across a refresh.
  useEffect(() => {
    const refresh = () => {
      const next = getSpotlightCycle();
      setSpotlightCycle((current) => current.endsAt === next.endsAt ? current : next);
    };
    const timer = window.setInterval(refresh, 1000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.removeItem("aurel-store:products:v1");
    } catch {
      // Storage is optional; old records are never read into the store.
    }
    const controller = new AbortController();
    setProductsLoading(true);
    setProductsError(null);

    fetchProductCatalog({ signal: controller.signal })
      .then((catalog) => {
        if (controller.signal.aborted) return;
        setRemoteProducts(catalog);
        writeStorage(STORAGE_KEYS.products, catalog);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setProductsError("We couldn't refresh the full catalog. Available products are still ready to browse.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setProductsLoading(false);
      });

    return () => controller.abort();
  }, [requestVersion]);

  const showToast = useCallback((message, duration = 2600) => {
    if (!message) {
      setToastState(null);
      return;
    }

    setToastState({
      message: String(message),
      duration: Math.max(500, Number(duration) || 2600),
    });
  }, []);

  const setToast = useCallback(
    (message) => {
      showToast(message);
    },
    [showToast],
  );

  const clearToast = useCallback(() => setToastState(null), []);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.cart, cart);
  }, [cart]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.wishlist, wishlist);
  }, [wishlist]);

  useEffect(() => {
    if (!toastState) return undefined;

    const timer = setTimeout(() => setToastState(null), toastState.duration);
    return () => clearTimeout(timer);
  }, [toastState]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncStoreAcrossTabs = (event) => {
      if (event.key === STORAGE_KEYS.cart) {
        try {
          setCart(sanitizeCart(event.newValue ? JSON.parse(event.newValue) : []));
        } catch {
          setCart([]);
        }
      }

      if (event.key === STORAGE_KEYS.wishlist) {
        try {
          setWishlist(
            sanitizeWishlist(event.newValue ? JSON.parse(event.newValue) : []),
          );
        } catch {
          setWishlist([]);
        }
      }
    };

    window.addEventListener("storage", syncStoreAcrossTabs);
    return () => window.removeEventListener("storage", syncStoreAcrossTabs);
  }, []);

  const addToCart = useCallback(
    (input, quantity = 1, color = null, size = null) => {
      const nextItem = normalizeCartInput(input, quantity, color, size);
      const product = productById.get(nextItem.productId);

      if (!product || product.stock === 0 || nextItem.quantity <= 0) {
        showToast("This item is currently unavailable.");
        return false;
      }

      setCart((currentCart) => {
        const existingIndex = currentCart.findIndex((item) =>
          lineMatches(item, nextItem.productId, nextItem.color, nextItem.size),
        );

        if (existingIndex === -1) return [...currentCart, nextItem];

        return currentCart.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: item.quantity + nextItem.quantity }
            : item,
        );
      });

      setCartOpen(true);
      setSearchOpen(false);
      setMobileMenuOpen(false);
      showToast(`${product.name} added to your bag.`);
      return true;
    },
    [productById, showToast],
  );

  const updateQuantity = useCallback(
    (input, quantity, color, size) => {
      const identity = normalizeCartInput(input, quantity, color, size);
      const nextQuantity = normalizeQuantity(quantity ?? input?.quantity, 1);
      const hasExactVariant =
        (input &&
          typeof input === "object" &&
          (Object.hasOwn(input, "color") || Object.hasOwn(input, "size"))) ||
        color !== undefined ||
        size !== undefined;

      setCart((currentCart) => {
        const matchingIndex = currentCart.findIndex((item) => {
          if (item.productId !== identity.productId) return false;
          return hasExactVariant
            ? lineMatches(item, identity.productId, identity.color, identity.size)
            : true;
        });

        if (matchingIndex === -1) return currentCart;
        if (nextQuantity <= 0) {
          return currentCart.filter((_, index) => index !== matchingIndex);
        }

        return currentCart.map((item, index) =>
          index === matchingIndex ? { ...item, quantity: nextQuantity } : item,
        );
      });
    },
    [],
  );

  const removeFromCart = useCallback(
    (input, color, size) => {
      const identity = normalizeCartInput(input, 1, color, size);
      const hasExactVariant =
        (input &&
          typeof input === "object" &&
          (Object.hasOwn(input, "color") || Object.hasOwn(input, "size"))) ||
        color !== undefined ||
        size !== undefined;

      setCart((currentCart) =>
        currentCart.filter((item) => {
          if (item.productId !== identity.productId) return true;
          if (!hasExactVariant) return false;
          return !lineMatches(item, identity.productId, identity.color, identity.size);
        }),
      );

      const product = productById.get(identity.productId);
      if (product) showToast(`${product.name} removed from your bag.`);
    },
    [productById, showToast],
  );

  const clearCart = useCallback(() => {
    setCart([]);
    setCartOpen(false);
  }, []);

  const toggleWishlist = useCallback(
    (input) => {
      const productId = String(
        input && typeof input === "object" ? input.productId ?? input.id ?? "" : input ?? "",
      );
      const product = productById.get(productId);
      if (!product) return false;

      const removing = wishlist.includes(productId);
      setWishlist((currentWishlist) =>
        currentWishlist.includes(productId)
          ? currentWishlist.filter((id) => id !== productId)
          : [...currentWishlist, productId],
      );
      showToast(
        removing
          ? `${product.name} removed from your wishlist.`
          : `${product.name} saved to your wishlist.`,
      );
      return !removing;
    },
    [productById, showToast, wishlist],
  );

  const isWishlisted = useCallback(
    (input) => {
      const productId = String(
        input && typeof input === "object" ? input.productId ?? input.id ?? "" : input ?? "",
      );
      return wishlist.includes(productId);
    },
    [wishlist],
  );

  const closeOverlays = useCallback(() => {
    setCartOpen(false);
    setSearchOpen(false);
    setMobileMenuOpen(false);
  }, []);

  const cartItems = useMemo(
    () =>
      cart
        .map((item) => {
          const product = productById.get(item.productId);
          return product ? { ...item, product } : null;
        })
        .filter(Boolean),
    [cart, productById],
  );

  const wishlistItems = useMemo(
    () => wishlist.map((id) => productById.get(id)).filter(Boolean),
    [wishlist, productById],
  );

  const cartCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart],
  );

  const cartSubtotal = useMemo(
    () =>
      cart.reduce((total, item) => {
        const product = productById.get(item.productId);
        return total + parsePrice(product?.price) * item.quantity;
      }, 0),
    [cart, productById],
  );

  const value = useMemo(
    () => ({
      products,
      spotlightItems,
      spotlightEndsAt: spotlightCycle.endsAt,
      productsLoading,
      productsError,
      reloadProducts,
      getProduct,
      cart,
      cartItems,
      cartCount,
      cartSubtotal,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      wishlist,
      wishlistItems,
      wishlistCount: wishlist.length,
      toggleWishlist,
      isWishlisted,
      cartOpen,
      setCartOpen,
      searchOpen,
      setSearchOpen,
      mobileMenuOpen,
      setMobileMenuOpen,
      closeOverlays,
      toast,
      setToast,
      showToast,
      clearToast,
    }),
    [
      products,
      spotlightItems,
      spotlightCycle.endsAt,
      productsLoading,
      productsError,
      reloadProducts,
      getProduct,
      addToCart,
      cart,
      cartCount,
      cartItems,
      cartOpen,
      cartSubtotal,
      clearCart,
      clearToast,
      closeOverlays,
      isWishlisted,
      mobileMenuOpen,
      removeFromCart,
      searchOpen,
      setToast,
      showToast,
      toast,
      toggleWishlist,
      updateQuantity,
      wishlist,
      wishlistItems,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider.");
  }
  return context;
}

export default StoreContext;

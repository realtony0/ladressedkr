import type { Locale } from "@/types/domain";

export interface Messages {
  languageName: string;
  common: {
    loading: string;
    retry: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    close: string;
    status: string;
    quantity: string;
    total: string;
    unavailable: string;
    noData: string;
    table: string;
    notes: string;
    confirm: string;
  };
  nav: {
    menu: string;
    kitchen: string;
    waiter: string;
    admin: string;
    owner: string;
    reports: string;
    staffLogin: string;
    logout: string;
  };
  client: {
    welcome: string;
    menuSubtitle: string;
    searchDish: string;
    searchPlaceholder: string;
    allergenFilter: string;
    clearFilter: string;
    quickCategories: string;
    activeOrders: string;
    noActiveOrders: string;
    openOrder: string;
    noResults: string;
    accompaniment: string;
    noAccompaniment: string;
    addToCart: string;
    cart: string;
    cartEmpty: string;
    orderNow: string;
    notePlaceholder: string;
    requiredAccompaniment: string;
    callServer: string;
    orderTracking: string;
    orderHistory: string;
    rateMeal: string;
    submitRating: string;
    specialRequestPlaceholder: string;
    brunchClosed: string;
    dishOfDay: string;
  };
  kitchen: {
    title: string;
    liveOrders: string;
    updateStatus: string;
    etaMinutes: string;
    markOutOfStock: string;
    printTicket: string;
    delayed: string;
    history: string;
    noOrders: string;
  };
  waiter: {
    title: string;
    incomingCalls: string;
    acknowledge: string;
    closeCall: string;
    readyOrders: string;
    activeTables: string;
    noCalls: string;
  };
  admin: {
    menuManagement: string;
    tableManagement: string;
    promotionManagement: string;
    serviceHours: string;
    staffManagement: string;
    addItem: string;
    addCategory: string;
    addTable: string;
    generateQr: string;
    printQr: string;
    deactivateQr: string;
    dishOfDay: string;
    enable: string;
    disable: string;
  };
  owner: {
    dashboard: string;
    revenue: string;
    orders: string;
    bestSellers: string;
    topTable: string;
    avgTicket: string;
    ratings: string;
    exportCsv: string;
    exportPdf: string;
    dailyReport: string;
    sendNow: string;
  };
  auth: {
    title: string;
    subtitle: string;
    email: string;
    password: string;
    accessCode: string;
    signin: string;
    invalid: string;
    invalidCode: string;
  };
}

export const messages: Record<Locale, Messages> = {
  fr: {
    languageName: "Français",
    common: {
      loading: "Chargement...",
      retry: "Réessayer",
      save: "Enregistrer",
      cancel: "Annuler",
      delete: "Supprimer",
      edit: "Modifier",
      close: "Fermer",
      status: "Statut",
      quantity: "Quantité",
      total: "Total",
      unavailable: "Indisponible",
      noData: "Aucune donnée",
      table: "Table",
      notes: "Notes",
      confirm: "Confirmer",
    },
    nav: {
      menu: "Menu",
      kitchen: "Cuisine",
      waiter: "Serveur",
      admin: "Admin",
      owner: "Propriétaire",
      reports: "Rapports",
      staffLogin: "Connexion staff",
      logout: "Se déconnecter",
    },
    client: {
      welcome: "Bienvenue à L'Adresse Dakar",
      menuSubtitle: "Cuisine élégante entre esprit bistro parisien et fraîcheur africaine.",
      searchDish: "Rechercher un plat",
      searchPlaceholder: "Ex: saumon, burger, burrata...",
      allergenFilter: "Filtrer par allergènes",
      clearFilter: "Effacer le filtre",
      quickCategories: "Accès rapide catégories",
      activeOrders: "Commandes en cours",
      noActiveOrders: "Aucune commande en cours pour cette table.",
      openOrder: "Ouvrir",
      noResults: "Aucun plat ne correspond à tes filtres.",
      accompaniment: "Accompagnement",
      noAccompaniment: "Pas d'accompagnement",
      addToCart: "Ajouter au panier",
      cart: "Panier",
      cartEmpty: "Ton panier est vide.",
      orderNow: "Valider la commande",
      notePlaceholder: "Précision cuisine (ex: sans oignon)",
      requiredAccompaniment: "Choix d'accompagnement obligatoire",
      callServer: "Appeler la cuisine",
      orderTracking: "Suivre ma commande",
      orderHistory: "Historique de session",
      rateMeal: "Noter le repas",
      submitRating: "Envoyer la note",
      specialRequestPlaceholder: "Détail de la demande spéciale",
      brunchClosed: "Le brunch n'est pas disponible sur ce créneau.",
      dishOfDay: "Plat du jour",
    },
    kitchen: {
      title: "Dashboard cuisine",
      liveOrders: "Commandes en direct",
      updateStatus: "Mettre à jour le statut",
      etaMinutes: "Temps estimé (minutes)",
      markOutOfStock: "Marquer épuisé",
      printTicket: "Imprimer ticket",
      delayed: "Commande en retard",
      history: "Historique du jour",
      noOrders: "Aucune commande en cours",
    },
    waiter: {
      title: "Dashboard serveur",
      incomingCalls: "Appels clients",
      acknowledge: "Acquitter",
      closeCall: "Clôturer",
      readyOrders: "Commandes prêtes",
      activeTables: "Tables actives",
      noCalls: "Aucun appel en attente",
    },
    admin: {
      menuManagement: "Gestion du menu",
      tableManagement: "Gestion des tables",
      promotionManagement: "Gestion des promotions",
      serviceHours: "Horaires de service",
      staffManagement: "Gestion du personnel",
      addItem: "Ajouter un plat",
      addCategory: "Ajouter une catégorie",
      addTable: "Ajouter une table",
      generateQr: "Générer QR",
      printQr: "Imprimer QR",
      deactivateQr: "Désactiver QR",
      dishOfDay: "Plat du jour",
      enable: "Activer",
      disable: "Désactiver",
    },
    owner: {
      dashboard: "Dashboard propriétaire",
      revenue: "Chiffre d'affaires",
      orders: "Commandes",
      bestSellers: "Top ventes",
      topTable: "Table la plus active",
      avgTicket: "Ticket moyen",
      ratings: "Notes clients",
      exportCsv: "Exporter CSV",
      exportPdf: "Exporter PDF",
      dailyReport: "Rapport journalier",
      sendNow: "Envoyer maintenant",
    },
    auth: {
      title: "Connexion équipe",
      subtitle: "Accès réservé à la cuisine, à l'admin et au propriétaire.",
      email: "Email professionnel",
      password: "Mot de passe",
      accessCode: "Code staff",
      signin: "Se connecter",
      invalid: "Identifiants invalides ou profil non autorisé.",
      invalidCode: "Code staff invalide.",
    },
  },
  en: {
    languageName: "English",
    common: {
      loading: "Loading...",
      retry: "Retry",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      close: "Close",
      status: "Status",
      quantity: "Quantity",
      total: "Total",
      unavailable: "Unavailable",
      noData: "No data",
      table: "Table",
      notes: "Notes",
      confirm: "Confirm",
    },
    nav: {
      menu: "Menu",
      kitchen: "Kitchen",
      waiter: "Waiter",
      admin: "Admin",
      owner: "Owner",
      reports: "Reports",
      staffLogin: "Staff login",
      logout: "Logout",
    },
    client: {
      welcome: "Welcome to L'Adresse Dakar",
      menuSubtitle: "Elegant cuisine blending Parisian bistro style with African freshness.",
      searchDish: "Search dish",
      searchPlaceholder: "e.g. salmon, burger, burrata...",
      allergenFilter: "Filter by allergens",
      clearFilter: "Clear filter",
      quickCategories: "Quick category access",
      activeOrders: "Active orders",
      noActiveOrders: "No active order for this table.",
      openOrder: "Open",
      noResults: "No dish matches your current filters.",
      accompaniment: "Side dish",
      noAccompaniment: "No side dish",
      addToCart: "Add to cart",
      cart: "Cart",
      cartEmpty: "Your cart is empty.",
      orderNow: "Place order",
      notePlaceholder: "Kitchen note (e.g. no onion)",
      requiredAccompaniment: "Side dish selection is required",
      callServer: "Call kitchen",
      orderTracking: "Track my order",
      orderHistory: "Session history",
      rateMeal: "Rate your meal",
      submitRating: "Submit rating",
      specialRequestPlaceholder: "Details about your special request",
      brunchClosed: "Brunch is not available right now.",
      dishOfDay: "Dish of the day",
    },
    kitchen: {
      title: "Kitchen dashboard",
      liveOrders: "Live orders",
      updateStatus: "Update status",
      etaMinutes: "Estimated prep time (minutes)",
      markOutOfStock: "Mark out of stock",
      printTicket: "Print ticket",
      delayed: "Delayed order",
      history: "Today's history",
      noOrders: "No active orders",
    },
    waiter: {
      title: "Waiter dashboard",
      incomingCalls: "Guest calls",
      acknowledge: "Acknowledge",
      closeCall: "Close",
      readyOrders: "Ready orders",
      activeTables: "Active tables",
      noCalls: "No pending calls",
    },
    admin: {
      menuManagement: "Menu management",
      tableManagement: "Table management",
      promotionManagement: "Promotion management",
      serviceHours: "Service hours",
      staffManagement: "Staff management",
      addItem: "Add item",
      addCategory: "Add category",
      addTable: "Add table",
      generateQr: "Generate QR",
      printQr: "Print QR",
      deactivateQr: "Deactivate QR",
      dishOfDay: "Dish of the day",
      enable: "Enable",
      disable: "Disable",
    },
    owner: {
      dashboard: "Owner dashboard",
      revenue: "Revenue",
      orders: "Orders",
      bestSellers: "Best sellers",
      topTable: "Most active table",
      avgTicket: "Average ticket",
      ratings: "Guest ratings",
      exportCsv: "Export CSV",
      exportPdf: "Export PDF",
      dailyReport: "Daily report",
      sendNow: "Send now",
    },
    auth: {
      title: "Team sign-in",
      subtitle: "Restricted access for kitchen, admin and owner.",
      email: "Professional email",
      password: "Password",
      accessCode: "Staff code",
      signin: "Sign in",
      invalid: "Invalid credentials or unauthorized profile.",
      invalidCode: "Invalid staff code.",
    },
  },
};

export function getMessages(locale: Locale) {
  return messages[locale] ?? messages.fr;
}

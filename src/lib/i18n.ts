// Internationalization (i18n) support for English and Spanish

type TranslationKey = keyof typeof translations.en;

export const translations = {
  en: {
    // Common
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.submit': 'Submit',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.view': 'View',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.all': 'All',
    'common.none': 'None',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.confirm': 'Confirm',
    'common.close': 'Close',
    
    // Auth
    'auth.login': 'Log In',
    'auth.signup': 'Sign Up',
    'auth.logout': 'Log Out',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.fullName': 'Full Name',
    'auth.forgotPassword': 'Forgot Password?',
    'auth.noAccount': "Don't have an account?",
    'auth.hasAccount': 'Already have an account?',
    'auth.loginSuccess': 'Logged in successfully',
    'auth.logoutSuccess': 'Logged out successfully',
    'auth.signupSuccess': 'Account created successfully',
    'auth.invalidCredentials': 'Invalid email or password',
    
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.requests': 'Requests',
    'nav.appointments': 'Appointments',
    'nav.settings': 'Settings',
    'nav.newRequest': 'New Request',
    'nav.myRequests': 'My Requests',
    'nav.analytics': 'Analytics',
    'nav.team': 'Team',
    
    // Requests
    'request.title': 'Title',
    'request.description': 'Description',
    'request.category': 'Category',
    'request.priority': 'Priority',
    'request.status': 'Status',
    'request.created': 'Created',
    'request.updated': 'Updated',
    'request.assignedTo': 'Assigned To',
    'request.emergency': 'Emergency',
    'request.attachments': 'Attachments',
    'request.submitNew': 'Submit New Request',
    'request.viewDetails': 'View Details',
    'request.updateStatus': 'Update Status',
    'request.addNote': 'Add Note',
    'request.reassign': 'Reassign',
    
    // Categories
    'category.academic': 'Academic',
    'category.financial': 'Financial Aid',
    'category.mental_health': 'Mental Health',
    'category.housing': 'Housing',
    'category.other': 'Other',
    
    // Priorities
    'priority.low': 'Low',
    'priority.medium': 'Medium',
    'priority.high': 'High',
    'priority.emergency': 'Emergency',
    
    // Statuses
    'status.submitted': 'Submitted',
    'status.in_progress': 'In Progress',
    'status.escalated': 'Escalated',
    'status.resolved': 'Resolved',
    'status.cancelled': 'Cancelled',
    
    // Appointments
    'appointment.schedule': 'Schedule Meeting',
    'appointment.title': 'Meeting Title',
    'appointment.date': 'Date',
    'appointment.time': 'Time',
    'appointment.duration': 'Duration',
    'appointment.with': 'Meeting With',
    'appointment.upcoming': 'Upcoming Appointments',
    'appointment.past': 'Past Appointments',
    
    // Dashboard
    'dashboard.welcome': 'Welcome',
    'dashboard.overview': 'Overview',
    'dashboard.recentRequests': 'Recent Requests',
    'dashboard.quickActions': 'Quick Actions',
    'dashboard.notifications': 'Notifications',
    'dashboard.workload': 'Workload',
    'dashboard.totalRequests': 'Total Requests',
    'dashboard.pendingRequests': 'Pending',
    'dashboard.resolvedRequests': 'Resolved',
    'dashboard.emergencies': 'Emergencies',
    
    // AI
    'ai.suggestions': 'AI Suggestions',
    'ai.insights': 'AI Insights',
    'ai.generated': 'AI Generated',
    'ai.dismiss': 'Dismiss',
    'ai.apply': 'Apply Suggestion',
    
    // Offline
    'offline.status': 'You are offline',
    'offline.savedAsDraft': 'Saved as draft',
    'offline.willSync': 'Will sync when online',
    'offline.syncing': 'Syncing...',
    'offline.synced': 'Synced',
    
    // Settings
    'settings.profile': 'Profile',
    'settings.notifications': 'Notifications',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.security': 'Security',
    'settings.accessibility': 'Accessibility',
  },
  es: {
    // Common
    'common.loading': 'Cargando...',
    'common.error': 'Ocurrió un error',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.submit': 'Enviar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.view': 'Ver',
    'common.back': 'Atrás',
    'common.next': 'Siguiente',
    'common.search': 'Buscar',
    'common.filter': 'Filtrar',
    'common.all': 'Todos',
    'common.none': 'Ninguno',
    'common.yes': 'Sí',
    'common.no': 'No',
    'common.confirm': 'Confirmar',
    'common.close': 'Cerrar',
    
    // Auth
    'auth.login': 'Iniciar Sesión',
    'auth.signup': 'Registrarse',
    'auth.logout': 'Cerrar Sesión',
    'auth.email': 'Correo Electrónico',
    'auth.password': 'Contraseña',
    'auth.fullName': 'Nombre Completo',
    'auth.forgotPassword': '¿Olvidaste tu contraseña?',
    'auth.noAccount': '¿No tienes una cuenta?',
    'auth.hasAccount': '¿Ya tienes una cuenta?',
    'auth.loginSuccess': 'Sesión iniciada exitosamente',
    'auth.logoutSuccess': 'Sesión cerrada exitosamente',
    'auth.signupSuccess': 'Cuenta creada exitosamente',
    'auth.invalidCredentials': 'Correo o contraseña inválidos',
    
    // Navigation
    'nav.dashboard': 'Panel',
    'nav.requests': 'Solicitudes',
    'nav.appointments': 'Citas',
    'nav.settings': 'Configuración',
    'nav.newRequest': 'Nueva Solicitud',
    'nav.myRequests': 'Mis Solicitudes',
    'nav.analytics': 'Análisis',
    'nav.team': 'Equipo',
    
    // Requests
    'request.title': 'Título',
    'request.description': 'Descripción',
    'request.category': 'Categoría',
    'request.priority': 'Prioridad',
    'request.status': 'Estado',
    'request.created': 'Creado',
    'request.updated': 'Actualizado',
    'request.assignedTo': 'Asignado A',
    'request.emergency': 'Emergencia',
    'request.attachments': 'Archivos Adjuntos',
    'request.submitNew': 'Enviar Nueva Solicitud',
    'request.viewDetails': 'Ver Detalles',
    'request.updateStatus': 'Actualizar Estado',
    'request.addNote': 'Agregar Nota',
    'request.reassign': 'Reasignar',
    
    // Categories
    'category.academic': 'Académico',
    'category.financial': 'Ayuda Financiera',
    'category.mental_health': 'Salud Mental',
    'category.housing': 'Vivienda',
    'category.other': 'Otro',
    
    // Priorities
    'priority.low': 'Baja',
    'priority.medium': 'Media',
    'priority.high': 'Alta',
    'priority.emergency': 'Emergencia',
    
    // Statuses
    'status.submitted': 'Enviado',
    'status.in_progress': 'En Progreso',
    'status.escalated': 'Escalado',
    'status.resolved': 'Resuelto',
    'status.cancelled': 'Cancelado',
    
    // Appointments
    'appointment.schedule': 'Programar Reunión',
    'appointment.title': 'Título de la Reunión',
    'appointment.date': 'Fecha',
    'appointment.time': 'Hora',
    'appointment.duration': 'Duración',
    'appointment.with': 'Reunión Con',
    'appointment.upcoming': 'Próximas Citas',
    'appointment.past': 'Citas Pasadas',
    
    // Dashboard
    'dashboard.welcome': 'Bienvenido',
    'dashboard.overview': 'Resumen',
    'dashboard.recentRequests': 'Solicitudes Recientes',
    'dashboard.quickActions': 'Acciones Rápidas',
    'dashboard.notifications': 'Notificaciones',
    'dashboard.workload': 'Carga de Trabajo',
    'dashboard.totalRequests': 'Total de Solicitudes',
    'dashboard.pendingRequests': 'Pendientes',
    'dashboard.resolvedRequests': 'Resueltas',
    'dashboard.emergencies': 'Emergencias',
    
    // AI
    'ai.suggestions': 'Sugerencias de IA',
    'ai.insights': 'Perspectivas de IA',
    'ai.generated': 'Generado por IA',
    'ai.dismiss': 'Descartar',
    'ai.apply': 'Aplicar Sugerencia',
    
    // Offline
    'offline.status': 'Estás sin conexión',
    'offline.savedAsDraft': 'Guardado como borrador',
    'offline.willSync': 'Se sincronizará cuando esté en línea',
    'offline.syncing': 'Sincronizando...',
    'offline.synced': 'Sincronizado',
    
    // Settings
    'settings.profile': 'Perfil',
    'settings.notifications': 'Notificaciones',
    'settings.language': 'Idioma',
    'settings.theme': 'Tema',
    'settings.security': 'Seguridad',
    'settings.accessibility': 'Accesibilidad',
  },
} as const;

export type Language = keyof typeof translations;

export function t(key: TranslationKey, language: Language = 'en'): string {
  return translations[language][key] || translations.en[key] || key;
}

export function getLanguageFromPreference(preference: string | null): Language {
  if (preference === 'es') return 'es';
  return 'en';
}

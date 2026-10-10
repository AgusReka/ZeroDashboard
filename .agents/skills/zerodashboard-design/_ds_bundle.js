/* @ds-bundle: {"format":4,"namespace":"ZeroDashboardDesignSystem_589ca0","components":[{"name":"AutomationCard","sourcePath":"components/automation/AutomationCard.jsx"},{"name":"Stepper","sourcePath":"components/automation/Stepper.jsx"},{"name":"TemplatePicker","sourcePath":"components/automation/TemplatePicker.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"ICONS","sourcePath":"components/core/iconData.js"},{"name":"DataTable","sourcePath":"components/data/DataTable.jsx"},{"name":"ESTADOS","sourcePath":"components/data/StatusBadge.jsx"},{"name":"StatusBadge","sourcePath":"components/data/StatusBadge.jsx"},{"name":"Banner","sourcePath":"components/feedback/Banner.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"ErrorState","sourcePath":"components/feedback/ErrorState.jsx"},{"name":"LoadingState","sourcePath":"components/feedback/LoadingState.jsx"},{"name":"Field","sourcePath":"components/forms/Field.jsx"},{"name":"KeyValueList","sourcePath":"components/layout/KeyValueList.jsx"},{"name":"PageHeader","sourcePath":"components/layout/PageHeader.jsx"},{"name":"ScopeTag","sourcePath":"components/layout/ScopeTag.jsx"},{"name":"SideNav","sourcePath":"components/navigation/SideNav.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"Dialog","sourcePath":"components/overlay/Dialog.jsx"},{"name":"Drawer","sourcePath":"components/overlay/Drawer.jsx"},{"name":"ConnectivityIndicator","sourcePath":"components/tenant/ConnectivityIndicator.jsx"},{"name":"TenantBar","sourcePath":"components/tenant/TenantBar.jsx"}],"sourceHashes":{"assets/icons.js":"4440af6edcd6","components/automation/AutomationCard.jsx":"5480ace57566","components/automation/Stepper.jsx":"ee2dd20fc631","components/automation/TemplatePicker.jsx":"9c63cd084241","components/core/Button.jsx":"7dca0f1844b0","components/core/Icon.jsx":"a6f6221496df","components/core/iconData.js":"23618070d8c2","components/data/DataTable.jsx":"1640bb37019d","components/data/StatusBadge.jsx":"e5c37f175325","components/feedback/Banner.jsx":"bb4f85d3f7fe","components/feedback/EmptyState.jsx":"6ab18843fdf1","components/feedback/ErrorState.jsx":"203f811e0850","components/feedback/LoadingState.jsx":"bf0e8dbaf2ef","components/forms/Field.jsx":"5d0bff9ad5ba","components/layout/KeyValueList.jsx":"7c993d918e52","components/layout/PageHeader.jsx":"a3347fe8c80d","components/layout/ScopeTag.jsx":"04d3792838a2","components/navigation/SideNav.jsx":"601c02e0a52c","components/navigation/Tabs.jsx":"18f62c40613a","components/overlay/Dialog.jsx":"65822c3118f5","components/overlay/Drawer.jsx":"c04e3b883e8c","components/tenant/ConnectivityIndicator.jsx":"a0ad168b5dd7","components/tenant/TenantBar.jsx":"4e40b2365d08","ui_kits/consola/app.js":"d1df60095460","ui_kits/consola/automatizaciones.js":"4dd05f75c37a","ui_kits/consola/conexiones.js":"1685ffd79c1e","ui_kits/consola/consultas.js":"f9211c142fcd","ui_kits/consola/datos-consola.js":"931740f731a4","ui_kits/datos-muestra.js":"c36639187b52","ui_kits/panel/PanelShell.jsx":"68655f1f898c","ui_kits/panel/Screens.jsx":"425831f80a29"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ZeroDashboardDesignSystem_589ca0 = window.ZeroDashboardDesignSystem_589ca0 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// assets/icons.js
try { (() => {
/* Íconos Lucide (lucide-static 0.460.0) para HTML plano: window.ZD_ICONS[nombre] = contenido interno del <svg>. */
window.ZD_ICONS = {
  "check": "<path d=\"M20 6 9 17l-5-5\" />",
  "x": "<path d=\"M18 6 6 18\" /><path d=\"m6 6 12 12\" />",
  "circle-check": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m9 12 2 2 4-4\" />",
  "circle-x": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m15 9-6 6\" /><path d=\"m9 9 6 6\" />",
  "circle-alert": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><line x1=\"12\" x2=\"12\" y1=\"8\" y2=\"12\" /><line x1=\"12\" x2=\"12.01\" y1=\"16\" y2=\"16\" />",
  "triangle-alert": "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\" /><path d=\"M12 9v4\" /><path d=\"M12 17h.01\" />",
  "info": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M12 16v-4\" /><path d=\"M12 8h.01\" />",
  "loader-circle": "<path d=\"M21 12a9 9 0 1 1-6.219-8.56\" />",
  "refresh-cw": "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /><path d=\"M21 3v5h-5\" /><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /><path d=\"M8 16H3v5\" />",
  "skip-forward": "<polygon points=\"5 4 15 12 5 20 5 4\" /><line x1=\"19\" x2=\"19\" y1=\"5\" y2=\"19\" />",
  "ban": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m4.9 4.9 14.2 14.2\" />",
  "copy-check": "<path d=\"m12 15 2 2 4-4\" /><rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\" /><path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\" />",
  "inbox": "<polyline points=\"22 12 16 12 14 15 10 15 8 12 2 12\" /><path d=\"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z\" />",
  "pause": "<rect x=\"14\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\" /><rect x=\"6\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\" />",
  "plus": "<path d=\"M5 12h14\" /><path d=\"M12 5v14\" />",
  "clock": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><polyline points=\"12 6 12 12 16 14\" />",
  "pencil": "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\" /><path d=\"m15 5 4 4\" />",
  "circle": "<circle cx=\"12\" cy=\"12\" r=\"10\" />",
  "chevron-left": "<path d=\"m15 18-6-6 6-6\" />",
  "chevron-right": "<path d=\"m9 18 6-6-6-6\" />",
  "chevron-down": "<path d=\"m6 9 6 6 6-6\" />",
  "arrow-left-right": "<path d=\"M8 3 4 7l4 4\" /><path d=\"M4 7h16\" /><path d=\"m16 21 4-4-4-4\" /><path d=\"M20 17H4\" />",
  "building-2": "<path d=\"M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z\" /><path d=\"M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2\" /><path d=\"M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2\" /><path d=\"M10 6h4\" /><path d=\"M10 10h4\" /><path d=\"M10 14h4\" /><path d=\"M10 18h4\" />",
  "database": "<ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\" /><path d=\"M3 5V19A9 3 0 0 0 21 19V5\" /><path d=\"M3 12A9 3 0 0 0 21 12\" />",
  "table": "<path d=\"M12 3v18\" /><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /><path d=\"M3 9h18\" /><path d=\"M3 15h18\" />",
  "play": "<polygon points=\"6 3 20 12 6 21 6 3\" />",
  "save": "<path d=\"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z\" /><path d=\"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7\" /><path d=\"M7 3v4a1 1 0 0 0 1 1h7\" />",
  "history": "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\" /><path d=\"M3 3v5h5\" /><path d=\"M12 7v5l4 2\" />",
  "calendar-clock": "<path d=\"M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5\" /><path d=\"M16 2v4\" /><path d=\"M8 2v4\" /><path d=\"M3 10h5\" /><path d=\"M17.5 17.5 16 16.3V14\" /><circle cx=\"16\" cy=\"16\" r=\"6\" />",
  "mail": "<rect width=\"20\" height=\"16\" x=\"2\" y=\"4\" rx=\"2\" /><path d=\"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7\" />",
  "plug": "<path d=\"M12 22v-5\" /><path d=\"M9 8V2\" /><path d=\"M15 8V2\" /><path d=\"M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z\" />",
  "unplug": "<path d=\"m19 5 3-3\" /><path d=\"m2 22 3-3\" /><path d=\"M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z\" /><path d=\"M7.5 13.5 10 11\" /><path d=\"M10.5 16.5 13 14\" /><path d=\"m12 6 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z\" />",
  "activity": "<path d=\"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2\" />",
  "key-round": "<path d=\"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z\" /><circle cx=\"16.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" />",
  "package": "<path d=\"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z\" /><path d=\"M12 22V12\" /><path d=\"m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7\" /><path d=\"m7.5 4.27 9 5.15\" />",
  "boxes": "<path d=\"M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z\" /><path d=\"m7 16.5-4.74-2.85\" /><path d=\"m7 16.5 5-3\" /><path d=\"M7 16.5v5.17\" /><path d=\"M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z\" /><path d=\"m17 16.5-5-3\" /><path d=\"m17 16.5 4.74-2.85\" /><path d=\"M17 16.5v5.17\" /><path d=\"M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z\" /><path d=\"M12 8 7.26 5.15\" /><path d=\"m12 8 4.74-2.85\" /><path d=\"M12 13.5V8\" />",
  "file-text": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\" /><path d=\"M14 2v4a2 2 0 0 0 2 2h4\" /><path d=\"M10 9H8\" /><path d=\"M16 13H8\" /><path d=\"M16 17H8\" />",
  "shield-check": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" /><path d=\"m9 12 2 2 4-4\" />",
  "sliders-horizontal": "<line x1=\"21\" x2=\"14\" y1=\"4\" y2=\"4\" /><line x1=\"10\" x2=\"3\" y1=\"4\" y2=\"4\" /><line x1=\"21\" x2=\"12\" y1=\"12\" y2=\"12\" /><line x1=\"8\" x2=\"3\" y1=\"12\" y2=\"12\" /><line x1=\"21\" x2=\"16\" y1=\"20\" y2=\"20\" /><line x1=\"12\" x2=\"3\" y1=\"20\" y2=\"20\" /><line x1=\"14\" x2=\"14\" y1=\"2\" y2=\"6\" /><line x1=\"8\" x2=\"8\" y1=\"10\" y2=\"14\" /><line x1=\"16\" x2=\"16\" y1=\"18\" y2=\"22\" />",
  "search": "<circle cx=\"11\" cy=\"11\" r=\"8\" /><path d=\"m21 21-4.3-4.3\" />",
  "settings": "<path d=\"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z\" /><circle cx=\"12\" cy=\"12\" r=\"3\" />",
  "log-out": "<path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\" /><polyline points=\"16 17 21 12 16 7\" /><line x1=\"21\" x2=\"9\" y1=\"12\" y2=\"12\" />",
  "server": "<rect width=\"20\" height=\"8\" x=\"2\" y=\"2\" rx=\"2\" ry=\"2\" /><rect width=\"20\" height=\"8\" x=\"2\" y=\"14\" rx=\"2\" ry=\"2\" /><line x1=\"6\" x2=\"6.01\" y1=\"6\" y2=\"6\" /><line x1=\"6\" x2=\"6.01\" y1=\"18\" y2=\"18\" />",
  "link": "<path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\" /><path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\" />",
  "trash-2": "<path d=\"M3 6h18\" /><path d=\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\" /><path d=\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\" /><line x1=\"10\" x2=\"10\" y1=\"11\" y2=\"17\" /><line x1=\"14\" x2=\"14\" y1=\"11\" y2=\"17\" />",
  "eye": "<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\" /><circle cx=\"12\" cy=\"12\" r=\"3\" />",
  "list": "<path d=\"M3 12h.01\" /><path d=\"M3 18h.01\" /><path d=\"M3 6h.01\" /><path d=\"M8 12h13\" /><path d=\"M8 18h13\" /><path d=\"M8 6h13\" />",
  "scroll-text": "<path d=\"M15 12h-5\" /><path d=\"M15 8h-5\" /><path d=\"M19 17V5a2 2 0 0 0-2-2H4\" /><path d=\"M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3\" />",
  "gauge": "<path d=\"m12 14 4-4\" /><path d=\"M3.34 19a10 10 0 1 1 17.32 0\" />",
  "timer": "<line x1=\"10\" x2=\"14\" y1=\"2\" y2=\"2\" /><line x1=\"12\" x2=\"15\" y1=\"14\" y2=\"11\" /><circle cx=\"12\" cy=\"14\" r=\"8\" />",
  "layout-dashboard": "<rect width=\"7\" height=\"9\" x=\"3\" y=\"3\" rx=\"1\" /><rect width=\"7\" height=\"5\" x=\"14\" y=\"3\" rx=\"1\" /><rect width=\"7\" height=\"9\" x=\"14\" y=\"12\" rx=\"1\" /><rect width=\"7\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\" />",
  "chart-column": "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\" /><path d=\"M18 17V9\" /><path d=\"M13 17V5\" /><path d=\"M8 17v-3\" />",
  "arrow-right": "<path d=\"M5 12h14\" /><path d=\"m12 5 7 7-7 7\" />",
  "arrow-left": "<path d=\"m12 19-7-7 7-7\" /><path d=\"M19 12H5\" />",
  "user": "<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\" /><circle cx=\"12\" cy=\"7\" r=\"4\" />",
  "bell": "<path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\" /><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\" />",
  "copy": "<rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\" /><path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\" />",
  "git-compare": "<circle cx=\"18\" cy=\"18\" r=\"3\" /><circle cx=\"6\" cy=\"6\" r=\"3\" /><path d=\"M13 6h3a2 2 0 0 1 2 2v7\" /><path d=\"M11 18H8a2 2 0 0 1-2-2V9\" />",
  "map": "<path d=\"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z\" /><path d=\"M15 5.764v15\" /><path d=\"M9 3.236v15\" />",
  "layers": "<path d=\"m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z\" /><path d=\"m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65\" /><path d=\"m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65\" />",
  "file-check": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\" /><path d=\"M14 2v4a2 2 0 0 0 2 2h4\" /><path d=\"m9 15 2 2 4-4\" />",
  "circle-help": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\" /><path d=\"M12 17h.01\" />",
  "lock": "<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\" /><path d=\"M7 11V7a5 5 0 0 1 10 0v4\" />",
  "external-link": "<path d=\"M15 3h6v6\" /><path d=\"M10 14 21 3\" /><path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\" />",
  "filter": "<polygon points=\"22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3\" />",
  "download": "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><polyline points=\"7 10 12 15 17 10\" /><line x1=\"12\" x2=\"12\" y1=\"15\" y2=\"3\" />",
  "zap-off": "<path d=\"M10.513 4.856 13.12 2.17a.5.5 0 0 1 .86.46l-1.377 4.317\" /><path d=\"M15.656 10H20a1 1 0 0 1 .78 1.63l-1.72 1.773\" /><path d=\"M16.273 16.273 10.88 21.83a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14H4a1 1 0 0 1-.78-1.63l4.507-4.643\" /><path d=\"m2 2 20 20\" />",
  "store": "<path d=\"m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7\" /><path d=\"M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8\" /><path d=\"M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4\" /><path d=\"M2 7h20\" /><path d=\"M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7\" />",
  "calendar": "<path d=\"M8 2v4\" /><path d=\"M16 2v4\" /><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\" /><path d=\"M3 10h18\" />",
  "moon": "<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\" />",
  "sun": "<circle cx=\"12\" cy=\"12\" r=\"4\" /><path d=\"M12 2v2\" /><path d=\"M12 20v2\" /><path d=\"m4.93 4.93 1.41 1.41\" /><path d=\"m17.66 17.66 1.41 1.41\" /><path d=\"M2 12h2\" /><path d=\"M20 12h2\" /><path d=\"m6.34 17.66-1.41 1.41\" /><path d=\"m19.07 4.93-1.41 1.41\" />",
  "menu": "<line x1=\"4\" x2=\"20\" y1=\"12\" y2=\"12\" /><line x1=\"4\" x2=\"20\" y1=\"6\" y2=\"6\" /><line x1=\"4\" x2=\"20\" y1=\"18\" y2=\"18\" />",
  "globe": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\" /><path d=\"M2 12h20\" />",
  "columns-2": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /><path d=\"M12 3v18\" />",
  "rotate-ccw": "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\" /><path d=\"M3 3v5h5\" />",
  "circle-dashed": "<path d=\"M10.1 2.182a10 10 0 0 1 3.8 0\" /><path d=\"M13.9 21.818a10 10 0 0 1-3.8 0\" /><path d=\"M17.609 3.721a10 10 0 0 1 2.69 2.7\" /><path d=\"M2.182 13.9a10 10 0 0 1 0-3.8\" /><path d=\"M20.279 17.609a10 10 0 0 1-2.7 2.69\" /><path d=\"M21.818 10.1a10 10 0 0 1 0 3.8\" /><path d=\"M3.721 6.391a10 10 0 0 1 2.7-2.69\" /><path d=\"M6.391 20.279a10 10 0 0 1-2.69-2.7\" />",
  "user-round": "<circle cx=\"12\" cy=\"8\" r=\"5\" /><path d=\"M20 21a8 8 0 0 0-16 0\" />",
  "power": "<path d=\"M12 2v10\" /><path d=\"M18.4 6.6a9 9 0 1 1-12.77.04\" />",
  "archive": "<rect width=\"20\" height=\"5\" x=\"2\" y=\"3\" rx=\"1\" /><path d=\"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8\" /><path d=\"M10 12h4\" />",
  "list-checks": "<path d=\"m3 17 2 2 4-4\" /><path d=\"m3 7 2 2 4-4\" /><path d=\"M13 6h8\" /><path d=\"M13 12h8\" /><path d=\"M13 18h8\" />",
  "cable": "<path d=\"M17 21v-2a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1\" /><path d=\"M19 15V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V9\" /><path d=\"M21 21v-2h-4\" /><path d=\"M3 5h4V3\" /><path d=\"M7 5a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1V3\" />",
  "panel-right": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /><path d=\"M15 3v18\" />",
  "mail-check": "<path d=\"M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8\" /><path d=\"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7\" /><path d=\"m16 19 2 2 4-4\" />",
  "mail-x": "<path d=\"M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h9\" /><path d=\"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7\" /><path d=\"m17 17 4 4\" /><path d=\"m21 17-4 4\" />",
  "hash": "<line x1=\"4\" x2=\"20\" y1=\"9\" y2=\"9\" /><line x1=\"4\" x2=\"20\" y1=\"15\" y2=\"15\" /><line x1=\"10\" x2=\"8\" y1=\"3\" y2=\"21\" /><line x1=\"16\" x2=\"14\" y1=\"3\" y2=\"21\" />"
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/icons.js", error: String((e && e.message) || e) }); }

// components/core/iconData.js
try { (() => {
const ICONS = {
  "check": "<path d=\"M20 6 9 17l-5-5\" />",
  "x": "<path d=\"M18 6 6 18\" /><path d=\"m6 6 12 12\" />",
  "circle-check": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m9 12 2 2 4-4\" />",
  "circle-x": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m15 9-6 6\" /><path d=\"m9 9 6 6\" />",
  "circle-alert": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><line x1=\"12\" x2=\"12\" y1=\"8\" y2=\"12\" /><line x1=\"12\" x2=\"12.01\" y1=\"16\" y2=\"16\" />",
  "triangle-alert": "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\" /><path d=\"M12 9v4\" /><path d=\"M12 17h.01\" />",
  "info": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M12 16v-4\" /><path d=\"M12 8h.01\" />",
  "loader-circle": "<path d=\"M21 12a9 9 0 1 1-6.219-8.56\" />",
  "refresh-cw": "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /><path d=\"M21 3v5h-5\" /><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /><path d=\"M8 16H3v5\" />",
  "skip-forward": "<polygon points=\"5 4 15 12 5 20 5 4\" /><line x1=\"19\" x2=\"19\" y1=\"5\" y2=\"19\" />",
  "ban": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m4.9 4.9 14.2 14.2\" />",
  "copy-check": "<path d=\"m12 15 2 2 4-4\" /><rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\" /><path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\" />",
  "inbox": "<polyline points=\"22 12 16 12 14 15 10 15 8 12 2 12\" /><path d=\"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z\" />",
  "pause": "<rect x=\"14\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\" /><rect x=\"6\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\" />",
  "plus": "<path d=\"M5 12h14\" /><path d=\"M12 5v14\" />",
  "clock": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><polyline points=\"12 6 12 12 16 14\" />",
  "pencil": "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\" /><path d=\"m15 5 4 4\" />",
  "circle": "<circle cx=\"12\" cy=\"12\" r=\"10\" />",
  "chevron-left": "<path d=\"m15 18-6-6 6-6\" />",
  "chevron-right": "<path d=\"m9 18 6-6-6-6\" />",
  "chevron-down": "<path d=\"m6 9 6 6 6-6\" />",
  "arrow-left-right": "<path d=\"M8 3 4 7l4 4\" /><path d=\"M4 7h16\" /><path d=\"m16 21 4-4-4-4\" /><path d=\"M20 17H4\" />",
  "building-2": "<path d=\"M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z\" /><path d=\"M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2\" /><path d=\"M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2\" /><path d=\"M10 6h4\" /><path d=\"M10 10h4\" /><path d=\"M10 14h4\" /><path d=\"M10 18h4\" />",
  "database": "<ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\" /><path d=\"M3 5V19A9 3 0 0 0 21 19V5\" /><path d=\"M3 12A9 3 0 0 0 21 12\" />",
  "table": "<path d=\"M12 3v18\" /><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /><path d=\"M3 9h18\" /><path d=\"M3 15h18\" />",
  "play": "<polygon points=\"6 3 20 12 6 21 6 3\" />",
  "save": "<path d=\"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z\" /><path d=\"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7\" /><path d=\"M7 3v4a1 1 0 0 0 1 1h7\" />",
  "history": "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\" /><path d=\"M3 3v5h5\" /><path d=\"M12 7v5l4 2\" />",
  "calendar-clock": "<path d=\"M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5\" /><path d=\"M16 2v4\" /><path d=\"M8 2v4\" /><path d=\"M3 10h5\" /><path d=\"M17.5 17.5 16 16.3V14\" /><circle cx=\"16\" cy=\"16\" r=\"6\" />",
  "mail": "<rect width=\"20\" height=\"16\" x=\"2\" y=\"4\" rx=\"2\" /><path d=\"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7\" />",
  "plug": "<path d=\"M12 22v-5\" /><path d=\"M9 8V2\" /><path d=\"M15 8V2\" /><path d=\"M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z\" />",
  "unplug": "<path d=\"m19 5 3-3\" /><path d=\"m2 22 3-3\" /><path d=\"M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z\" /><path d=\"M7.5 13.5 10 11\" /><path d=\"M10.5 16.5 13 14\" /><path d=\"m12 6 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z\" />",
  "activity": "<path d=\"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2\" />",
  "key-round": "<path d=\"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z\" /><circle cx=\"16.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" />",
  "package": "<path d=\"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z\" /><path d=\"M12 22V12\" /><path d=\"m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7\" /><path d=\"m7.5 4.27 9 5.15\" />",
  "boxes": "<path d=\"M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z\" /><path d=\"m7 16.5-4.74-2.85\" /><path d=\"m7 16.5 5-3\" /><path d=\"M7 16.5v5.17\" /><path d=\"M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z\" /><path d=\"m17 16.5-5-3\" /><path d=\"m17 16.5 4.74-2.85\" /><path d=\"M17 16.5v5.17\" /><path d=\"M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z\" /><path d=\"M12 8 7.26 5.15\" /><path d=\"m12 8 4.74-2.85\" /><path d=\"M12 13.5V8\" />",
  "file-text": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\" /><path d=\"M14 2v4a2 2 0 0 0 2 2h4\" /><path d=\"M10 9H8\" /><path d=\"M16 13H8\" /><path d=\"M16 17H8\" />",
  "shield-check": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" /><path d=\"m9 12 2 2 4-4\" />",
  "sliders-horizontal": "<line x1=\"21\" x2=\"14\" y1=\"4\" y2=\"4\" /><line x1=\"10\" x2=\"3\" y1=\"4\" y2=\"4\" /><line x1=\"21\" x2=\"12\" y1=\"12\" y2=\"12\" /><line x1=\"8\" x2=\"3\" y1=\"12\" y2=\"12\" /><line x1=\"21\" x2=\"16\" y1=\"20\" y2=\"20\" /><line x1=\"12\" x2=\"3\" y1=\"20\" y2=\"20\" /><line x1=\"14\" x2=\"14\" y1=\"2\" y2=\"6\" /><line x1=\"8\" x2=\"8\" y1=\"10\" y2=\"14\" /><line x1=\"16\" x2=\"16\" y1=\"18\" y2=\"22\" />",
  "search": "<circle cx=\"11\" cy=\"11\" r=\"8\" /><path d=\"m21 21-4.3-4.3\" />",
  "settings": "<path d=\"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z\" /><circle cx=\"12\" cy=\"12\" r=\"3\" />",
  "log-out": "<path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\" /><polyline points=\"16 17 21 12 16 7\" /><line x1=\"21\" x2=\"9\" y1=\"12\" y2=\"12\" />",
  "server": "<rect width=\"20\" height=\"8\" x=\"2\" y=\"2\" rx=\"2\" ry=\"2\" /><rect width=\"20\" height=\"8\" x=\"2\" y=\"14\" rx=\"2\" ry=\"2\" /><line x1=\"6\" x2=\"6.01\" y1=\"6\" y2=\"6\" /><line x1=\"6\" x2=\"6.01\" y1=\"18\" y2=\"18\" />",
  "link": "<path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\" /><path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\" />",
  "trash-2": "<path d=\"M3 6h18\" /><path d=\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\" /><path d=\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\" /><line x1=\"10\" x2=\"10\" y1=\"11\" y2=\"17\" /><line x1=\"14\" x2=\"14\" y1=\"11\" y2=\"17\" />",
  "eye": "<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\" /><circle cx=\"12\" cy=\"12\" r=\"3\" />",
  "list": "<path d=\"M3 12h.01\" /><path d=\"M3 18h.01\" /><path d=\"M3 6h.01\" /><path d=\"M8 12h13\" /><path d=\"M8 18h13\" /><path d=\"M8 6h13\" />",
  "scroll-text": "<path d=\"M15 12h-5\" /><path d=\"M15 8h-5\" /><path d=\"M19 17V5a2 2 0 0 0-2-2H4\" /><path d=\"M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3\" />",
  "gauge": "<path d=\"m12 14 4-4\" /><path d=\"M3.34 19a10 10 0 1 1 17.32 0\" />",
  "timer": "<line x1=\"10\" x2=\"14\" y1=\"2\" y2=\"2\" /><line x1=\"12\" x2=\"15\" y1=\"14\" y2=\"11\" /><circle cx=\"12\" cy=\"14\" r=\"8\" />",
  "layout-dashboard": "<rect width=\"7\" height=\"9\" x=\"3\" y=\"3\" rx=\"1\" /><rect width=\"7\" height=\"5\" x=\"14\" y=\"3\" rx=\"1\" /><rect width=\"7\" height=\"9\" x=\"14\" y=\"12\" rx=\"1\" /><rect width=\"7\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\" />",
  "chart-column": "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\" /><path d=\"M18 17V9\" /><path d=\"M13 17V5\" /><path d=\"M8 17v-3\" />",
  "arrow-right": "<path d=\"M5 12h14\" /><path d=\"m12 5 7 7-7 7\" />",
  "arrow-left": "<path d=\"m12 19-7-7 7-7\" /><path d=\"M19 12H5\" />",
  "user": "<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\" /><circle cx=\"12\" cy=\"7\" r=\"4\" />",
  "bell": "<path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\" /><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\" />",
  "copy": "<rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\" /><path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\" />",
  "git-compare": "<circle cx=\"18\" cy=\"18\" r=\"3\" /><circle cx=\"6\" cy=\"6\" r=\"3\" /><path d=\"M13 6h3a2 2 0 0 1 2 2v7\" /><path d=\"M11 18H8a2 2 0 0 1-2-2V9\" />",
  "map": "<path d=\"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z\" /><path d=\"M15 5.764v15\" /><path d=\"M9 3.236v15\" />",
  "layers": "<path d=\"m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z\" /><path d=\"m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65\" /><path d=\"m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65\" />",
  "file-check": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\" /><path d=\"M14 2v4a2 2 0 0 0 2 2h4\" /><path d=\"m9 15 2 2 4-4\" />",
  "circle-help": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\" /><path d=\"M12 17h.01\" />",
  "lock": "<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\" /><path d=\"M7 11V7a5 5 0 0 1 10 0v4\" />",
  "external-link": "<path d=\"M15 3h6v6\" /><path d=\"M10 14 21 3\" /><path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\" />",
  "filter": "<polygon points=\"22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3\" />",
  "download": "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><polyline points=\"7 10 12 15 17 10\" /><line x1=\"12\" x2=\"12\" y1=\"15\" y2=\"3\" />",
  "zap-off": "<path d=\"M10.513 4.856 13.12 2.17a.5.5 0 0 1 .86.46l-1.377 4.317\" /><path d=\"M15.656 10H20a1 1 0 0 1 .78 1.63l-1.72 1.773\" /><path d=\"M16.273 16.273 10.88 21.83a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14H4a1 1 0 0 1-.78-1.63l4.507-4.643\" /><path d=\"m2 2 20 20\" />",
  "store": "<path d=\"m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7\" /><path d=\"M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8\" /><path d=\"M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4\" /><path d=\"M2 7h20\" /><path d=\"M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7\" />",
  "calendar": "<path d=\"M8 2v4\" /><path d=\"M16 2v4\" /><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\" /><path d=\"M3 10h18\" />",
  "moon": "<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\" />",
  "sun": "<circle cx=\"12\" cy=\"12\" r=\"4\" /><path d=\"M12 2v2\" /><path d=\"M12 20v2\" /><path d=\"m4.93 4.93 1.41 1.41\" /><path d=\"m17.66 17.66 1.41 1.41\" /><path d=\"M2 12h2\" /><path d=\"M20 12h2\" /><path d=\"m6.34 17.66-1.41 1.41\" /><path d=\"m19.07 4.93-1.41 1.41\" />",
  "menu": "<line x1=\"4\" x2=\"20\" y1=\"12\" y2=\"12\" /><line x1=\"4\" x2=\"20\" y1=\"6\" y2=\"6\" /><line x1=\"4\" x2=\"20\" y1=\"18\" y2=\"18\" />",
  "globe": "<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\" /><path d=\"M2 12h20\" />",
  "columns-2": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /><path d=\"M12 3v18\" />",
  "rotate-ccw": "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\" /><path d=\"M3 3v5h5\" />",
  "circle-dashed": "<path d=\"M10.1 2.182a10 10 0 0 1 3.8 0\" /><path d=\"M13.9 21.818a10 10 0 0 1-3.8 0\" /><path d=\"M17.609 3.721a10 10 0 0 1 2.69 2.7\" /><path d=\"M2.182 13.9a10 10 0 0 1 0-3.8\" /><path d=\"M20.279 17.609a10 10 0 0 1-2.7 2.69\" /><path d=\"M21.818 10.1a10 10 0 0 1 0 3.8\" /><path d=\"M3.721 6.391a10 10 0 0 1 2.7-2.69\" /><path d=\"M6.391 20.279a10 10 0 0 1-2.69-2.7\" />",
  "user-round": "<circle cx=\"12\" cy=\"8\" r=\"5\" /><path d=\"M20 21a8 8 0 0 0-16 0\" />",
  "power": "<path d=\"M12 2v10\" /><path d=\"M18.4 6.6a9 9 0 1 1-12.77.04\" />",
  "archive": "<rect width=\"20\" height=\"5\" x=\"2\" y=\"3\" rx=\"1\" /><path d=\"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8\" /><path d=\"M10 12h4\" />",
  "list-checks": "<path d=\"m3 17 2 2 4-4\" /><path d=\"m3 7 2 2 4-4\" /><path d=\"M13 6h8\" /><path d=\"M13 12h8\" /><path d=\"M13 18h8\" />",
  "cable": "<path d=\"M17 21v-2a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1\" /><path d=\"M19 15V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V9\" /><path d=\"M21 21v-2h-4\" /><path d=\"M3 5h4V3\" /><path d=\"M7 5a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1V3\" />",
  "panel-right": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /><path d=\"M15 3v18\" />",
  "mail-check": "<path d=\"M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8\" /><path d=\"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7\" /><path d=\"m16 19 2 2 4-4\" />",
  "mail-x": "<path d=\"M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h9\" /><path d=\"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7\" /><path d=\"m17 17 4 4\" /><path d=\"m21 17-4 4\" />",
  "hash": "<line x1=\"4\" x2=\"20\" y1=\"9\" y2=\"9\" /><line x1=\"4\" x2=\"20\" y1=\"15\" y2=\"15\" /><line x1=\"10\" x2=\"8\" y1=\"3\" y2=\"21\" /><line x1=\"16\" x2=\"14\" y1=\"3\" y2=\"21\" />"
};
Object.assign(__ds_scope, { ICONS });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/iconData.js", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function Icon({
  name,
  size,
  label,
  spin = false,
  className = '',
  style = {}
}) {
  const s = Object.assign({}, size ? {
    width: size,
    height: size
  } : {}, style);
  return /*#__PURE__*/React.createElement("svg", {
    className: 'zd-icon' + (spin ? ' zd-icon--spin' : '') + (className ? ' ' + className : ''),
    style: s,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    role: label ? 'img' : undefined,
    "aria-label": label || undefined,
    "aria-hidden": label ? undefined : 'true',
    focusable: "false",
    dangerouslySetInnerHTML: {
      __html: __ds_scope.ICONS[name] || __ds_scope.ICONS['circle']
    }
  });
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/automation/Stepper.jsx
try { (() => {
function Stepper({
  steps,
  current = 0,
  label = 'Progreso'
}) {
  return /*#__PURE__*/React.createElement("ol", {
    className: "zd-steps",
    "aria-label": label
  }, steps.map((s, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: 'zd-step' + (i < current ? ' is-done' : ''),
    "aria-current": i === current ? 'step' : undefined
  }, /*#__PURE__*/React.createElement("span", {
    className: "zd-step__n"
  }, i < current ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 13,
    label: "Completado"
  }) : i + 1), /*#__PURE__*/React.createElement("span", null, s))));
}
Object.assign(__ds_scope, { Stepper });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/automation/Stepper.jsx", error: String((e && e.message) || e) }); }

// components/automation/TemplatePicker.jsx
try { (() => {
function TemplatePicker({
  options,
  value,
  onChange,
  name = 'plantilla',
  legend = 'Plantilla'
}) {
  return /*#__PURE__*/React.createElement("fieldset", {
    className: "zd-templates",
    "data-change": "CH-21",
    "data-estado": "pendiente"
  }, /*#__PURE__*/React.createElement("legend", {
    className: "zd-sr"
  }, legend), options.map(o => /*#__PURE__*/React.createElement("label", {
    key: o.id,
    className: "zd-template"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: name,
    value: o.id,
    checked: value === o.id,
    onChange: () => onChange && onChange(o.id)
  }), /*#__PURE__*/React.createElement("span", {
    className: "zd-template__icon"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: o.icon || 'file-text'
  })), /*#__PURE__*/React.createElement("span", {
    className: "zd-template__name"
  }, o.nombre), /*#__PURE__*/React.createElement("span", {
    className: "zd-template__desc"
  }, o.descripcion), o.meta ? /*#__PURE__*/React.createElement("span", {
    className: "zd-meta"
  }, o.meta) : null, /*#__PURE__*/React.createElement("span", {
    className: "zd-template__check"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "circle-check",
    label: "Seleccionada"
  })))));
}
Object.assign(__ds_scope, { TemplatePicker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/automation/TemplatePicker.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  iconOnly = false,
  label,
  block = false,
  loading = false,
  disabled,
  type = 'button',
  children,
  className = '',
  ...rest
}) {
  const cls = ['zd-btn', 'zd-btn--' + variant, size !== 'md' ? 'zd-btn--' + size : '', iconOnly ? 'zd-btn--icon' : '', block ? 'zd-btn--block' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    className: cls,
    disabled: disabled || loading,
    "aria-busy": loading || undefined,
    "aria-label": iconOnly ? label : undefined,
    title: iconOnly ? label : undefined
  }, rest), loading ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "loader-circle",
    spin: true
  }) : icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon
  }) : null, !iconOnly && (children ?? label), iconRight && !iconOnly ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight
  }) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/data/DataTable.jsx
try { (() => {
function cellClass(col) {
  return col.align === 'num' ? 'is-num' : col.align === 'mono' ? 'is-mono' : undefined;
}
function DataTable({
  columns,
  rows,
  caption,
  page = 1,
  pageSize = 25,
  total,
  onPageChange,
  compact = false,
  nullLabel = 'NULL',
  emptyMessage = 'Sin filas.',
  rowKey,
  onRowClick,
  selectedKey,
  footerNote,
  maxHeight
}) {
  const count = total ?? rows.length;
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);
  return /*#__PURE__*/React.createElement("div", {
    className: "zd-table-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "zd-table-scroll",
    style: maxHeight ? {
      maxHeight
    } : undefined
  }, /*#__PURE__*/React.createElement("table", {
    className: 'zd-table' + (compact ? ' zd-table--compact' : '')
  }, caption ? /*#__PURE__*/React.createElement("caption", {
    className: "zd-sr"
  }, caption) : null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    scope: "col",
    className: cellClass(c),
    style: c.width ? {
      width: c.width
    } : undefined
  }, c.label)))), /*#__PURE__*/React.createElement("tbody", null, rows.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: columns.length,
    className: "zd-muted",
    style: {
      textAlign: 'center',
      padding: '24px'
    }
  }, emptyMessage)) : rows.map((r, i) => {
    const k = rowKey ? r[rowKey] : i;
    return /*#__PURE__*/React.createElement("tr", {
      key: k,
      "aria-selected": selectedKey !== undefined && selectedKey === k ? 'true' : undefined,
      onClick: onRowClick ? () => onRowClick(r, i) : undefined,
      style: onRowClick ? {
        cursor: 'pointer'
      } : undefined
    }, columns.map(c => {
      const v = r[c.key];
      const isNull = v === null || v === undefined;
      return /*#__PURE__*/React.createElement("td", {
        key: c.key,
        className: [cellClass(c), isNull && !c.render ? 'is-null' : ''].filter(Boolean).join(' ') || undefined
      }, c.render ? c.render(v, r) : isNull ? nullLabel : String(v));
    }));
  })))), onPageChange || footerNote ? /*#__PURE__*/React.createElement("div", {
    className: "zd-pager"
  }, /*#__PURE__*/React.createElement("span", {
    className: "zd-num"
  }, from, "\u2013", to, " de ", count.toLocaleString('es-AR')), footerNote ? /*#__PURE__*/React.createElement("span", null, footerNote) : null, /*#__PURE__*/React.createElement("span", {
    className: "zd-pager__spacer"
  }), onPageChange ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    variant: "secondary",
    icon: "chevron-left",
    iconOnly: true,
    label: "P\xE1gina anterior",
    disabled: page <= 1,
    onClick: () => onPageChange(page - 1)
  }), /*#__PURE__*/React.createElement("span", {
    className: "zd-num"
  }, "P\xE1gina ", page, " de ", pages), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    variant: "secondary",
    icon: "chevron-right",
    iconOnly: true,
    label: "P\xE1gina siguiente",
    disabled: page >= pages,
    onClick: () => onPageChange(page + 1)
  })) : null) : null);
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/data/StatusBadge.jsx
try { (() => {
const ESTADOS = {
  exitosa: ['ok', 'circle-check', 'Exitosa'],
  fallida: ['error', 'circle-x', 'Fallida'],
  en_curso: ['info', 'loader-circle', 'En curso'],
  reintentando: ['info', 'refresh-cw', 'Reintentando'],
  omitida: ['neutral', 'skip-forward', 'Omitida por solapamiento'],
  interrumpida: ['warn', 'ban', 'Interrumpida'],
  duplicado_evitado: ['neutral', 'copy-check', 'Duplicado evitado'],
  sin_datos: ['neutral', 'inbox', 'Sin datos'],
  activa: ['ok', 'circle-check', 'Activa'],
  pausada: ['neutral', 'pause', 'Pausada'],
  con_falla: ['error', 'circle-alert', 'Con falla'],
  disponible: ['neutral', 'plus', 'Disponible'],
  en_riesgo: ['warn', 'triangle-alert', 'En riesgo'],
  desactualizada: ['warn', 'clock', 'Datos desactualizados'],
  borrador: ['neutral', 'pencil', 'Borrador']
};
function StatusBadge({
  estado,
  tone,
  icon,
  label,
  square = false,
  attempt
}) {
  const def = ESTADOS[estado] || ['neutral', 'circle', estado || ''];
  const t = tone || def[0];
  const ic = icon || def[1];
  let text = label || def[2];
  if (estado === 'reintentando' && attempt) text = text + ' (' + attempt + ')';
  return /*#__PURE__*/React.createElement("span", {
    className: 'zd-badge' + (t !== 'neutral' ? ' zd-badge--' + t : '') + (square ? ' zd-badge--square' : ''),
    "data-estado": estado
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: ic,
    spin: estado === 'en_curso'
  }), text);
}
Object.assign(__ds_scope, { ESTADOS, StatusBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatusBadge.jsx", error: String((e && e.message) || e) }); }

// components/automation/AutomationCard.jsx
try { (() => {
function AutomationCard({
  titulo,
  descripcion,
  estado = 'activa',
  estadoLabel,
  ultima,
  proxima,
  frecuencia,
  children,
  alert,
  disponible = false
}) {
  return /*#__PURE__*/React.createElement("article", {
    className: 'zd-card zd-auto-card' + (disponible ? ' zd-auto-card--disponible' : '')
  }, /*#__PURE__*/React.createElement("div", {
    className: "zd-card__head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "zd-auto-card__title"
  }, titulo), descripcion ? /*#__PURE__*/React.createElement("p", {
    className: "zd-auto-card__desc"
  }, descripcion) : null), /*#__PURE__*/React.createElement(__ds_scope.StatusBadge, {
    estado: disponible ? 'disponible' : estado,
    label: estadoLabel
  })), alert, !disponible && (ultima || proxima || frecuencia) ? /*#__PURE__*/React.createElement("dl", {
    className: "zd-auto-card__times"
  }, ultima ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "\xDAltima ejecuci\xF3n"), /*#__PURE__*/React.createElement("dd", null, ultima)) : null, proxima ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "Pr\xF3xima ejecuci\xF3n"), /*#__PURE__*/React.createElement("dd", null, proxima)) : null, frecuencia ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "Frecuencia"), /*#__PURE__*/React.createElement("dd", null, frecuencia)) : null) : null, children ? /*#__PURE__*/React.createElement("div", {
    className: "zd-auto-card__actions"
  }, children) : null);
}
Object.assign(__ds_scope, { AutomationCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/automation/AutomationCard.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Banner.jsx
try { (() => {
const ICONS = {
  info: 'info',
  ok: 'circle-check',
  warn: 'triangle-alert',
  error: 'circle-alert',
  neutral: 'info'
};
function Banner({
  tone = 'info',
  title,
  children,
  actions,
  icon,
  inline = false,
  onDismiss,
  role
}) {
  const r = role || (tone === 'error' || tone === 'warn' ? 'alert' : 'status');
  return /*#__PURE__*/React.createElement("div", {
    className: 'zd-banner zd-banner--' + tone + (inline ? ' zd-banner--inline' : ''),
    role: r
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon || ICONS[tone]
  }), /*#__PURE__*/React.createElement("div", null, title ? /*#__PURE__*/React.createElement("p", {
    className: "zd-banner__title"
  }, title) : null, children ? /*#__PURE__*/React.createElement("div", {
    className: "zd-banner__body"
  }, children) : null), /*#__PURE__*/React.createElement("div", {
    className: "zd-banner__actions"
  }, actions, onDismiss ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    variant: "ghost",
    iconOnly: true,
    icon: "x",
    label: "Cerrar aviso",
    onClick: onDismiss
  }) : null));
}
Object.assign(__ds_scope, { Banner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Banner.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
function EmptyState({
  icon = 'inbox',
  title,
  children,
  actions
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "zd-state",
    role: "status"
  }, /*#__PURE__*/React.createElement("span", {
    className: "zd-state__icon"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon
  })), /*#__PURE__*/React.createElement("p", {
    className: "zd-state__title"
  }, title), children ? /*#__PURE__*/React.createElement("p", {
    className: "zd-state__body"
  }, children) : null, actions ? /*#__PURE__*/React.createElement("div", {
    className: "zd-state__actions"
  }, actions) : null);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ErrorState.jsx
try { (() => {
function ErrorState({
  title = 'Algo salió mal',
  children,
  detail,
  actions,
  icon = 'circle-alert'
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "zd-state zd-state--error",
    role: "alert"
  }, /*#__PURE__*/React.createElement("span", {
    className: "zd-state__icon"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon
  })), /*#__PURE__*/React.createElement("p", {
    className: "zd-state__title"
  }, title), children ? /*#__PURE__*/React.createElement("p", {
    className: "zd-state__body"
  }, children) : null, detail ? /*#__PURE__*/React.createElement("code", {
    className: "zd-code",
    style: {
      maxWidth: '100%',
      textAlign: 'left',
      fontSize: 'var(--text-xs)'
    }
  }, detail) : null, actions ? /*#__PURE__*/React.createElement("div", {
    className: "zd-state__actions"
  }, actions) : null);
}
Object.assign(__ds_scope, { ErrorState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ErrorState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/LoadingState.jsx
try { (() => {
function LoadingState({
  label = 'Cargando…',
  variant = 'spinner',
  rows = 4
}) {
  if (variant === 'skeleton') {
    return /*#__PURE__*/React.createElement("div", {
      role: "status",
      "aria-live": "polite",
      style: {
        display: 'grid',
        gap: 'var(--space-5)',
        padding: 'var(--space-6)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "zd-sr"
    }, label), Array.from({
      length: rows
    }).map((_, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      className: "zd-skeleton",
      style: {
        width: 92 - i % 3 * 18 + '%'
      }
    })));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "zd-state",
    role: "status",
    "aria-live": "polite"
  }, /*#__PURE__*/React.createElement("span", {
    className: "zd-spinner",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("p", {
    className: "zd-state__body"
  }, label));
}
Object.assign(__ds_scope, { LoadingState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/LoadingState.jsx", error: String((e && e.message) || e) }); }

// components/forms/Field.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
let _n = 0;
function Field({
  label,
  id,
  as = 'input',
  help,
  error,
  optional = false,
  suffix,
  mono = false,
  children,
  className = '',
  ...rest
}) {
  const autoId = React.useMemo(() => id || 'zd-f-' + ++_n, [id]);
  const helpId = help ? autoId + '-help' : null;
  const errId = error ? autoId + '-err' : null;
  const describedBy = [helpId, errId].filter(Boolean).join(' ') || undefined;
  const base = as === 'select' ? 'zd-select' : as === 'textarea' ? 'zd-textarea' : 'zd-input';
  const cls = base + (mono ? ' ' + base + '--code' : '');
  const common = {
    id: autoId,
    className: cls,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describedBy,
    ...rest
  };
  let control = as === 'select' ? /*#__PURE__*/React.createElement("select", common, children) : as === 'textarea' ? /*#__PURE__*/React.createElement("textarea", _extends({
    spellCheck: mono ? false : undefined
  }, common)) : /*#__PURE__*/React.createElement("input", common);
  if (suffix && as === 'input') control = /*#__PURE__*/React.createElement("div", {
    className: "zd-input-group"
  }, control, /*#__PURE__*/React.createElement("span", {
    className: "zd-input-suffix"
  }, suffix));
  return /*#__PURE__*/React.createElement("div", {
    className: 'zd-field' + (className ? ' ' + className : '')
  }, /*#__PURE__*/React.createElement("label", {
    className: "zd-label",
    htmlFor: autoId
  }, label, optional ? /*#__PURE__*/React.createElement("span", {
    className: "zd-optional"
  }, " (opcional)") : null), control, help ? /*#__PURE__*/React.createElement("span", {
    className: "zd-help",
    id: helpId
  }, help) : null, error ? /*#__PURE__*/React.createElement("span", {
    className: "zd-field-error",
    id: errId
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "circle-alert"
  }), error) : null);
}
Object.assign(__ds_scope, { Field });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Field.jsx", error: String((e && e.message) || e) }); }

// components/layout/KeyValueList.jsx
try { (() => {
function KeyValueList({
  items,
  layout = 'rows'
}) {
  if (layout === 'grid') {
    return /*#__PURE__*/React.createElement("dl", {
      className: "zd-kvgrid"
    }, items.map((it, i) => /*#__PURE__*/React.createElement("div", {
      key: i
    }, /*#__PURE__*/React.createElement("dt", null, it.label), /*#__PURE__*/React.createElement("dd", {
      className: it.mono ? 'zd-mono' : undefined
    }, it.value ?? '—'))));
  }
  return /*#__PURE__*/React.createElement("dl", {
    className: 'zd-kv' + (layout === 'stack' ? ' zd-kv--stack' : '')
  }, items.map((it, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, /*#__PURE__*/React.createElement("dt", null, it.label), /*#__PURE__*/React.createElement("dd", {
    className: it.mono ? 'is-mono' : undefined
  }, it.value ?? '—'))));
}
Object.assign(__ds_scope, { KeyValueList });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/KeyValueList.jsx", error: String((e && e.message) || e) }); }

// components/layout/ScopeTag.jsx
try { (() => {
function ScopeTag({
  scope = 'tenant',
  tenantName
}) {
  if (scope === 'global') return /*#__PURE__*/React.createElement("span", {
    className: "zd-scope zd-scope--global"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "globe"
  }), "Global \xB7 todos los tenants");
  if (!tenantName) return /*#__PURE__*/React.createElement("span", {
    className: "zd-scope zd-scope--none"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "triangle-alert"
  }), "Sin tenant activo");
  return /*#__PURE__*/React.createElement("span", {
    className: "zd-scope zd-scope--tenant"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "building-2"
  }), "Tenant activo: ", tenantName);
}
Object.assign(__ds_scope, { ScopeTag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/ScopeTag.jsx", error: String((e && e.message) || e) }); }

// components/layout/PageHeader.jsx
try { (() => {
function PageHeader({
  title,
  description,
  scope,
  tenantName,
  crumbs,
  change,
  estado,
  actions
}) {
  return /*#__PURE__*/React.createElement("header", {
    className: "zd-pagehead"
  }, /*#__PURE__*/React.createElement("div", {
    className: "zd-pagehead__text"
  }, crumbs ? /*#__PURE__*/React.createElement("nav", {
    className: "zd-pagehead__crumbs",
    "aria-label": "Ruta"
  }, crumbs) : null, scope || change ? /*#__PURE__*/React.createElement("div", {
    className: "zd-pagehead__meta"
  }, scope ? /*#__PURE__*/React.createElement(__ds_scope.ScopeTag, {
    scope: scope,
    tenantName: tenantName
  }) : null, change ? /*#__PURE__*/React.createElement("span", {
    className: "zd-tag",
    title: "Change y estado de dise\xF1o"
  }, change, estado ? ' · ' + estado : '') : null) : null, /*#__PURE__*/React.createElement("h1", {
    className: "zd-h1"
  }, title), description ? /*#__PURE__*/React.createElement("p", {
    className: "zd-pagehead__desc"
  }, description) : null), actions ? /*#__PURE__*/React.createElement("div", {
    className: "zd-pagehead__actions"
  }, actions) : null);
}
Object.assign(__ds_scope, { PageHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/PageHeader.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SideNav.jsx
try { (() => {
function Item({
  it,
  current,
  onNavigate
}) {
  const on = current === it.id;
  return /*#__PURE__*/React.createElement("a", {
    className: "zd-sidenav__item",
    href: it.href || '#' + it.id,
    "aria-current": on ? 'page' : undefined,
    onClick: onNavigate ? e => {
      e.preventDefault();
      onNavigate(it.id);
    } : undefined
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: it.icon || 'circle'
  }), /*#__PURE__*/React.createElement("span", null, it.label), it.meta ? /*#__PURE__*/React.createElement("span", {
    className: "zd-sidenav__meta"
  }, it.meta) : null);
}
function SideNav({
  brand = 'ZeroDashboard',
  surfaceLabel = 'Consola',
  global = [],
  tenantName,
  tenantGroups = [],
  current,
  onNavigate,
  footer
}) {
  return /*#__PURE__*/React.createElement("nav", {
    className: "zd-sidenav",
    "aria-label": "Secciones de la consola"
  }, /*#__PURE__*/React.createElement("div", {
    className: "zd-sidenav__brand"
  }, /*#__PURE__*/React.createElement("span", {
    className: "zd-sidenav__brandname"
  }, brand), /*#__PURE__*/React.createElement("span", {
    className: "zd-eyebrow"
  }, surfaceLabel)), global.length ? /*#__PURE__*/React.createElement("div", {
    className: "zd-sidenav__group"
  }, /*#__PURE__*/React.createElement("span", {
    className: "zd-sidenav__heading"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "globe"
  }), "Global"), global.map(it => /*#__PURE__*/React.createElement(Item, {
    key: it.id,
    it: it,
    current: current,
    onNavigate: onNavigate
  }))) : null, tenantGroups.length ? /*#__PURE__*/React.createElement("div", {
    className: "zd-sidenav__scope"
  }, /*#__PURE__*/React.createElement("div", {
    className: "zd-sidenav__tenant"
  }, /*#__PURE__*/React.createElement("span", {
    className: "zd-sidenav__heading",
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "building-2"
  }), "Tenant activo"), /*#__PURE__*/React.createElement("b", null, tenantName || 'Ninguno')), tenantGroups.map(g => /*#__PURE__*/React.createElement(React.Fragment, {
    key: g.label
  }, /*#__PURE__*/React.createElement("span", {
    className: "zd-sidenav__subheading"
  }, g.label), g.items.map(it => /*#__PURE__*/React.createElement(Item, {
    key: it.id,
    it: it,
    current: current,
    onNavigate: onNavigate
  }))))) : null, footer ? /*#__PURE__*/React.createElement("div", {
    className: "zd-sidenav__foot"
  }, footer) : null);
}
Object.assign(__ds_scope, { SideNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SideNav.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  tabs,
  value,
  onChange,
  label = 'Secciones'
}) {
  const refs = React.useRef([]);
  const onKey = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    refs.current[n] && refs.current[n].focus();
    onChange && onChange(tabs[n].id);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "zd-tabs",
    role: "tablist",
    "aria-label": label
  }, tabs.map((t, i) => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    ref: el => refs.current[i] = el,
    type: "button",
    role: "tab",
    className: "zd-tab",
    "aria-selected": value === t.id,
    tabIndex: value === t.id ? 0 : -1,
    onClick: () => onChange && onChange(t.id),
    onKeyDown: e => onKey(e, i)
  }, t.icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: t.icon
  }) : null, t.label, t.count != null ? /*#__PURE__*/React.createElement("span", {
    className: "zd-tab__count"
  }, t.count) : null)));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/overlay/Dialog.jsx
try { (() => {
let _d = 0;
function Dialog({
  open = true,
  title,
  children,
  actions,
  onClose
}) {
  const id = React.useMemo(() => 'zd-dlg-' + ++_d, []);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const f = ref.current && ref.current.querySelector('[autofocus], .zd-btn--primary, .zd-btn--danger, input');
    f && f.focus();
    const k = e => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "zd-dialog-backdrop",
    onClick: e => {
      if (e.target === e.currentTarget && onClose) onClose();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "zd-dialog",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": id,
    ref: ref
  }, /*#__PURE__*/React.createElement("h2", {
    className: "zd-dialog__title",
    id: id
  }, title), typeof children === 'string' ? /*#__PURE__*/React.createElement("p", {
    className: "zd-dialog__body"
  }, children) : children, actions ? /*#__PURE__*/React.createElement("div", {
    className: "zd-dialog__actions"
  }, actions) : null));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlay/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/overlay/Drawer.jsx
try { (() => {
function Drawer({
  open = true,
  eyebrow,
  title,
  children,
  footer,
  onClose,
  wide = false
}) {
  React.useEffect(() => {
    if (!open || !onClose) return;
    const k = e => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return /*#__PURE__*/React.createElement("aside", {
    className: 'zd-drawer' + (wide ? ' zd-drawer--wide' : ''),
    role: "dialog",
    "aria-modal": "false",
    "aria-label": typeof title === 'string' ? title : undefined
  }, /*#__PURE__*/React.createElement("div", {
    className: "zd-drawer__head"
  }, /*#__PURE__*/React.createElement("div", null, eyebrow ? /*#__PURE__*/React.createElement("span", {
    className: "zd-eyebrow"
  }, eyebrow) : null, /*#__PURE__*/React.createElement("h2", {
    className: "zd-h2"
  }, title)), onClose ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    variant: "ghost",
    iconOnly: true,
    icon: "x",
    label: "Cerrar panel",
    onClick: onClose
  }) : null), /*#__PURE__*/React.createElement("div", {
    className: "zd-drawer__body"
  }, children), footer ? /*#__PURE__*/React.createElement("div", {
    className: "zd-drawer__foot"
  }, footer) : null);
}
Object.assign(__ds_scope, { Drawer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlay/Drawer.jsx", error: String((e && e.message) || e) }); }

// components/tenant/ConnectivityIndicator.jsx
try { (() => {
const LABELS = {
  conectado: 'Conectado',
  desconectado: 'Desconectado',
  sin_datos: 'Sin latidos'
};
function ConnectivityIndicator({
  estado = 'sin_datos',
  ultimoLatido,
  label,
  onDark = false
}) {
  const s = onDark ? {
    color: 'inherit'
  } : undefined;
  return /*#__PURE__*/React.createElement("span", {
    className: 'zd-conn zd-conn--' + estado.replace('_', '-'),
    role: "status",
    "data-change": "CH-19d1",
    "data-estado": "pendiente"
  }, /*#__PURE__*/React.createElement("span", {
    className: "zd-conn__dot",
    "aria-hidden": "true",
    style: onDark ? {
      boxShadow: '0 0 0 2px rgba(255,255,255,.5)'
    } : undefined
  }), /*#__PURE__*/React.createElement("span", {
    className: "zd-conn__label",
    style: s
  }, label || LABELS[estado]), ultimoLatido ? /*#__PURE__*/React.createElement("span", {
    className: "zd-conn__beat",
    style: onDark ? {
      color: 'inherit',
      opacity: .85
    } : undefined
  }, "\xB7 \xFAltimo latido ", ultimoLatido) : null);
}
Object.assign(__ds_scope, { ConnectivityIndicator });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/tenant/ConnectivityIndicator.jsx", error: String((e && e.message) || e) }); }

// components/tenant/TenantBar.jsx
try { (() => {
function TenantBar({
  tenant,
  onChange,
  children
}) {
  if (!tenant) {
    return /*#__PURE__*/React.createElement("div", {
      className: "zd-tenantbar zd-tenantbar--none",
      role: "region",
      "aria-label": "Tenant activo",
      "data-change": "CH-06",
      "data-estado": "existe"
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "triangle-alert"
    }), /*#__PURE__*/React.createElement("span", {
      className: "zd-tenantbar__name",
      style: {
        fontSize: 'var(--text-sm)'
      }
    }, "Ning\xFAn tenant seleccionado"), /*#__PURE__*/React.createElement("span", null, "Eleg\xED uno para operar."), /*#__PURE__*/React.createElement("span", {
      className: "zd-tenantbar__spacer"
    }), onChange ? /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "zd-tenantbar__btn",
      onClick: onChange
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "arrow-left-right"
    }), "Elegir tenant") : null);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "zd-tenantbar",
    role: "region",
    "aria-label": "Tenant activo",
    "data-change": "CH-06",
    "data-estado": "existe"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "building-2"
  }), /*#__PURE__*/React.createElement("span", {
    className: "zd-tenantbar__label"
  }, "Tenant activo"), /*#__PURE__*/React.createElement("span", {
    className: "zd-tenantbar__name"
  }, tenant.nombre), tenant.id ? /*#__PURE__*/React.createElement("span", {
    className: "zd-tenantbar__id"
  }, tenant.id) : null, /*#__PURE__*/React.createElement("span", {
    className: "zd-tenantbar__spacer"
  }), children, onChange ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "zd-tenantbar__btn",
    onClick: onChange
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "arrow-left-right"
  }), "Cambiar tenant") : null);
}
Object.assign(__ds_scope, { TenantBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/tenant/TenantBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/consola/app.js
try { (() => {
/* Consola — esqueleto (HTML + CSS + JS plano). Todo valor de datos pasa por esc(): se escribe como texto, nunca como marcado. */
(function () {
  const D = window.DATOS_CONSOLA,
    I = window.ZD_ICONS;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
  const ic = (n, attrs = '') => `<svg class="zd-icon" ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${I[n] || I.circle}</svg>`;
  const EST = {
    ok: ['ok', 'circle-check', 'OK'],
    fallo: ['error', 'circle-x', 'Fallo'],
    omitida: ['neutral', 'skip-forward', 'Omitida por solapamiento'],
    interrumpida: ['warn', 'ban', 'Interrumpida'],
    reintentando: ['info', 'refresh-cw', 'Reintentando'],
    activa: ['ok', 'circle-check', 'Activa'],
    inactiva: ['neutral', 'pause', 'Desactivada'],
    vigente: ['ok', 'circle-check', 'Vigente'],
    probada: ['ok', 'circle-check', 'Conexión OK'],
    noprobada: ['error', 'circle-x', 'Falló la prueba'],
    revocado: ['neutral', 'ban', 'Revocado'],
    pendiente: ['neutral', 'circle-dashed', 'Pendiente'],
    baja: ['neutral', 'archive', 'Dado de baja']
  };
  const badge = (k, label) => {
    const e = EST[k];
    return `<span class="zd-badge${e[0] !== 'neutral' ? ' zd-badge--' + e[0] : ''}${k === 'pendiente' ? ' zd-badge--pending' : ''}">${ic(e[1])}${esc(label || e[2])}</span>`;
  };
  const btn = (label, o = {}) => {
    const cls = ['zd-btn', 'zd-btn--' + (o.variant || 'secondary'), o.size ? 'zd-btn--' + o.size : '', o.iconOnly ? 'zd-btn--icon' : '', o.block ? 'zd-btn--block' : ''].filter(Boolean).join(' ');
    return `<button type="${o.type || 'button'}" class="${cls}"${o.act ? ` data-act="${o.act}"` : ''}${o.arg != null ? ` data-arg="${esc(o.arg)}"` : ''}${o.disabled ? ' disabled' : ''}${o.iconOnly ? ` aria-label="${esc(label)}" title="${esc(label)}"` : ''}${o.attrs || ''}>${o.icon ? ic(o.icon) : ''}${o.iconOnly ? '' : esc(label)}</button>`;
  };
  const banner = (tone, title, body = '', actions = '', o = {}) => {
    const icons = {
      info: 'info',
      ok: 'circle-check',
      warn: 'triangle-alert',
      error: 'circle-alert',
      neutral: 'info'
    };
    return `<div class="zd-banner zd-banner--${tone}${o.inline ? ' zd-banner--inline' : ''}" role="${tone === 'error' || tone === 'warn' ? 'alert' : 'status'}"${o.attrs || ''}>${ic(o.icon || icons[tone])}<div><p class="zd-banner__title">${title}</p>${body ? `<div class="zd-banner__body">${body}</div>` : ''}</div><div class="zd-banner__actions">${actions}</div></div>`;
  };
  let fid = 0;
  const field = (label, control, o = {}) => `<div class="zd-field"><label class="zd-label" for="${o.id}">${esc(label)}${o.optional ? '<span class="zd-optional"> (opcional)</span>' : ''}</label>${control}${o.help ? `<span class="zd-help" id="${o.id}-h">${esc(o.help)}</span>` : ''}</div>`;
  const nid = () => 'f' + ++fid;
  const fmt = v => v === null || v === undefined ? '<span class="is-null">NULL</span>' : esc(v);
  const table = (cols, rows, o = {}) => `<div class="zd-table-wrap"><div class="zd-table-scroll"><table class="zd-table zd-table--compact"><caption class="zd-sr">${esc(o.caption)}</caption><thead><tr>${cols.map(c => `<th scope="col" class="${c.cls || ''}">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr${o.rowAct ? ` data-act="${o.rowAct}" data-arg="${esc(r.id)}" tabindex="0" style="cursor:pointer"` : ''}${o.selected && o.selected === r.id ? ' aria-selected="true"' : ''}>${cols.map(c => `<td class="${c.cls || ''}">${c.html ? c.html(r) : fmt(r[c.key])}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="zd-muted" style="text-align:center;padding:24px">${esc(o.empty || 'Sin filas.')}</td></tr>`}</tbody></table></div>${o.foot || ''}</div>`;
  const scope = (kind, ctx) => kind === 'global' ? `<span class="zd-scope zd-scope--global">${ic('globe')}Global · todos los tenants</span>` : ctx.tenant ? `<span class="zd-scope zd-scope--tenant">${ic('building-2')}Tenant activo: ${esc(ctx.tenant.nombre)}</span>` : `<span class="zd-scope zd-scope--none">${ic('triangle-alert')}Sin tenant activo</span>`;
  const pageHead = o => `<header class="zd-pagehead"><div class="zd-pagehead__text">${o.crumbs ? `<nav class="zd-pagehead__crumbs" aria-label="Ruta">${o.crumbs}</nav>` : ''}<div class="zd-pagehead__meta">${scope(o.scope, o.ctx)}${o.change ? `<span class="zd-tag" title="Change y estado de diseño">${esc(o.change)} · ${esc(o.estado)}</span>` : ''}</div><h1 class="zd-h1">${esc(o.title)}</h1>${o.desc ? `<p class="zd-pagehead__desc">${o.desc}</p>` : ''}</div>${o.actions ? `<div class="zd-pagehead__actions">${o.actions}</div>` : ''}</header>`;
  const dialog = (title, body, actions, o = {}) => `<div class="zd-dialog-backdrop" data-act="${o.closeAct || 'close'}" data-self="1"><div class="zd-dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><h2 class="zd-dialog__title" id="dlg-t">${title}</h2>${body}<div class="zd-dialog__actions">${actions}</div></div></div>`;
  const drawer = (eyebrow, title, body, foot = '', o = {}) => `<aside class="zd-drawer${o.wide ? ' zd-drawer--wide' : ''}" role="dialog" aria-modal="false" aria-labelledby="drw-t"><div class="zd-drawer__head"><div>${eyebrow ? `<span class="zd-eyebrow">${eyebrow}</span>` : ''}<h2 class="zd-h2" id="drw-t">${title}</h2></div>${btn('Cerrar panel', {
    iconOnly: true,
    icon: 'x',
    variant: 'ghost',
    size: 'sm',
    act: o.closeAct || 'close'
  })}</div><div class="zd-drawer__body">${body}</div>${foot ? `<div class="zd-drawer__foot">${foot}</div>` : ''}</aside>`;
  const empty = (icon, title, body, actions = '') => `<div class="zd-state" role="status"><span class="zd-state__icon">${ic(icon)}</span><p class="zd-state__title">${esc(title)}</p>${body ? `<p class="zd-state__body">${body}</p>` : ''}${actions ? `<div class="zd-state__actions">${actions}</div>` : ''}</div>`;
  const conn = (estado, latido, onDark) => {
    const L = {
      conectado: 'Conectado',
      desconectado: 'Desconectado',
      sin_datos: 'Sin latidos'
    };
    return `<span class="zd-conn zd-conn--${estado.replace('_', '-')}" data-change="CH-19d1" data-estado="pendiente"><span class="zd-conn__dot" aria-hidden="true"${onDark ? ' style="box-shadow:0 0 0 2px rgba(255,255,255,.5)"' : ''}></span><span class="zd-conn__label"${onDark ? ' style="color:inherit"' : ''}>${L[estado]}</span>${latido ? `<span class="zd-conn__beat"${onDark ? ' style="color:inherit;opacity:.85"' : ''}>· ${esc(latido)}</span>` : ''}</span>`;
  };
  const frozenBanner = ctx => ctx.frozen ? banner('neutral', `${esc(ctx.tenant.nombre)} está dado de baja desde el ${esc(ctx.tenant.baja)}`, 'La baja es lógica y congela todo: podés ver la configuración y el historial, pero no crear, ejecutar ni modificar nada.', '', {
    icon: 'archive'
  }) : '';
  const noTenant = what => `<div class="zd-card" style="padding:0">${empty('building-2', 'Elegí un tenant para operar', `${esc(what)} pertenecen a un tenant. Elegí uno en la barra de arriba.`, btn('Elegir tenant', {
    variant: 'primary',
    icon: 'arrow-left-right',
    act: 'app:switch'
  }))}</div>`;
  window.ZD = {
    D,
    esc,
    ic,
    badge,
    btn,
    banner,
    field,
    nid,
    fmt,
    table,
    pageHead,
    dialog,
    drawer,
    empty,
    conn,
    frozenBanner,
    noTenant,
    screens: {}
  };
  const NAV = [{
    scope: 'global',
    items: [['tenants', 'Tenants', 'building-2', 'API'], ['plantillas', 'Plantillas', 'file-text', 'API'], ['contrato', 'Contrato canónico', 'layers', 'API']]
  }, {
    scope: 'tenant',
    sub: 'Puesta en marcha',
    items: [['conexiones', 'Conexiones y agentes', 'cable'], ['mapeo', 'Mapeo y validación', 'list-checks', 'API'], ['tiempos', 'Tiempos de alta', 'gauge', 'API']]
  }, {
    scope: 'tenant',
    sub: 'Trabajo diario',
    items: [['consultas', 'Consultas', 'database'], ['automatizaciones', 'Automatizaciones', 'calendar-clock'], ['frescura', 'Frescura de datos', 'timer'], ['auditoria', 'Auditoría', 'scroll-text', 'Pendiente']]
  }];
  const state = {
    tenantId: localStorage.getItem('zd-consola-tenant') ?? 'ten_7f3a',
    switching: false,
    switchSel: null
  };
  const ctxOf = () => {
    const t = D.tenants.find(x => x.id === state.tenantId) || null;
    return {
      tenant: t,
      frozen: !!t && t.estado === 'baja'
    };
  };
  const route = () => {
    const h = (location.hash || '#consultas').slice(1).split('/');
    return {
      id: h[0] || 'consultas',
      sub: h.slice(1).join('/')
    };
  };
  function renderBar(ctx) {
    const t = ctx.tenant;
    const op = `<span class="zd-operator" title="Reservado para la identidad del operador. No implementado: la consola no tiene autenticación.">${ic('user-round')}Operador: no implementado</span>`;
    if (!t) return `<div class="zd-tenantbar zd-tenantbar--none" role="region" aria-label="Tenant activo" data-change="CH-06" data-estado="existe">${ic('triangle-alert')}<span class="zd-tenantbar__name" style="font-size:var(--text-sm)">Ningún tenant seleccionado</span><span>Elegí uno para operar.</span><span class="zd-tenantbar__spacer"></span>${op}<button type="button" class="zd-tenantbar__btn" data-act="app:switch">${ic('arrow-left-right')}Elegir tenant</button></div>`;
    return `<div class="zd-tenantbar" role="region" aria-label="Tenant activo" data-change="CH-06" data-estado="existe">${ic('building-2')}<span class="zd-tenantbar__label">Tenant activo</span><span class="zd-tenantbar__name">${esc(t.nombre)}</span><span class="zd-tenantbar__id">${esc(t.id)}</span>${ctx.frozen ? `<span class="zd-tenantbar__flag">${ic('archive')}Dado de baja · congelado</span>` : ''}<span class="zd-tenantbar__spacer"></span>${conn(t.agente, t.latido ? 'último latido ' + t.latido : '', true)}${op}<button type="button" class="zd-tenantbar__btn" data-act="app:switch">${ic('arrow-left-right')}Cambiar tenant</button></div>`;
  }
  function renderNav(ctx, cur) {
    const item = ([id, label, icon, meta]) => `<a class="zd-sidenav__item" href="#${id}"${cur === id ? ' aria-current="page"' : ''}>${ic(icon)}<span>${esc(label)}</span>${meta ? `<span class="zd-sidenav__meta" title="${meta === 'API' ? 'Existe la API, la pantalla es nueva' : 'Diseño anticipado'}">${meta}</span>` : ''}</a>`;
    let html = `<div class="zd-sidenav__brand"><span class="zd-sidenav__brandname">ZeroDashboard</span><span class="zd-eyebrow">Consola</span></div>`;
    html += `<div class="zd-sidenav__group"><span class="zd-sidenav__heading">${ic('globe')}Global</span>${NAV[0].items.map(item).join('')}</div>`;
    html += `<div class="zd-sidenav__scope"><div class="zd-sidenav__tenant"><span class="zd-sidenav__heading" style="padding:0">${ic('building-2')}Tenant activo</span><b>${ctx.tenant ? esc(ctx.tenant.nombre) : 'Ninguno'}</b></div>`;
    NAV.slice(1).forEach(g => {
      html += `<span class="zd-sidenav__subheading">${g.sub}</span>${g.items.map(item).join('')}`;
    });
    html += `</div><div class="zd-sidenav__foot"><span class="zd-meta" style="flex:1">Modo</span>${btn('Cambiar modo claro/oscuro', {
      iconOnly: true,
      size: 'sm',
      variant: 'ghost',
      icon: document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon',
      act: 'app:theme'
    })}</div>`;
    return html;
  }
  function renderSwitcher() {
    const sel = state.switchSel ?? state.tenantId;
    const t = D.tenants.find(x => x.id === sel);
    const opts = D.tenants.map(x => `<label class="zd-template" style="flex-direction:row;align-items:center;padding:var(--space-5);gap:var(--space-5)"><input type="radio" name="tenant" value="${esc(x.id)}" data-change-act="app:pick"${sel === x.id ? ' checked' : ''}>${ic('building-2')}<span style="flex:1;display:grid;gap:2px"><span class="zd-template__name">${esc(x.nombre)}</span><span class="zd-meta">${esc(x.id)} · alta ${esc(x.alta)}</span></span>${x.estado === 'baja' ? badge('baja') : conn(x.agente)}</label>`).join('');
    const label = !t ? 'Elegí un tenant' : t.id === state.tenantId ? 'Ya es el tenant activo' : 'Operar sobre ' + t.nombre;
    return dialog('Cambiar tenant activo', `<div style="display:grid;gap:var(--space-3)" role="radiogroup" aria-label="Tenants">${opts}</div><p class="zd-meta" style="margin:0">Todo lo que hagas después del cambio se aplica al tenant elegido. Para dar de alta o de baja, usá <a href="#tenants" data-act="app:closeSwitch">Tenants</a>.</p>`, btn('Cancelar', {
      act: 'app:closeSwitch'
    }) + btn(label, {
      variant: 'primary',
      act: 'app:confirmSwitch',
      disabled: !t || t.id === state.tenantId
    }), {
      closeAct: 'app:closeSwitch'
    });
  }
  const root = document.getElementById('app');
  function render() {
    const ctx = ctxOf(),
      r = route();
    const scr = window.ZD.screens[r.id] || window.ZD.screens._spec;
    root.innerHTML = renderBar(ctx) + `<div class="zd-shell"><nav class="zd-sidenav" aria-label="Secciones de la consola">${renderNav(ctx, r.id)}</nav><main class="zd-page" id="zd-main" data-screen-label="${esc(r.id)}">${scr.render(ctx, r.sub, r.id)}</main></div>` + (state.switching ? renderSwitcher() : '');
    const af = root.querySelector('.zd-dialog [autofocus], .zd-drawer [autofocus]') || root.querySelector('.zd-dialog .zd-btn--primary:not(:disabled), .zd-dialog input');
    if (af) af.focus();
  }
  window.ZD.render = render;
  window.ZD.ctx = ctxOf;
  window.ZD.go = h => {
    if (location.hash === '#' + h) render();else location.hash = h;
  };
  const appActs = {
    switch: () => {
      state.switching = true;
      state.switchSel = null;
    },
    closeSwitch: () => {
      state.switching = false;
    },
    pick: el => {
      state.switchSel = el.value;
    },
    confirmSwitch: () => {
      state.tenantId = state.switchSel;
      localStorage.setItem('zd-consola-tenant', state.tenantId);
      state.switching = false;
      Object.values(window.ZD.screens).forEach(s => s.reset && s.reset());
    },
    theme: () => {
      const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = n;
    }
  };
  function dispatch(act, el, ev) {
    if (act.startsWith('app:')) {
      appActs[act.slice(4)](el, ev);
      render();
      return;
    }
    const scr = window.ZD.screens[route().id] || window.ZD.screens._spec;
    const fn = scr.on && scr.on[act];
    if (fn && fn(el, ctxOf(), ev) !== false) render();
  }
  root.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    if (el.dataset.self && ev.target !== el) return;
    if (el.tagName === 'A' && el.getAttribute('href')?.startsWith('#') && el.dataset.act === 'app:closeSwitch') {
      state.switching = false;
      return;
    }
    ev.preventDefault();
    dispatch(el.dataset.act, el, ev);
  });
  root.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') {
      if (state.switching) {
        state.switching = false;
        render();
      } else if (root.querySelector('.zd-dialog, .zd-drawer')) dispatch('close', null, ev);
    }
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('tr[data-act]')) {
      ev.preventDefault();
      dispatch(ev.target.dataset.act, ev.target, ev);
    }
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && ev.target.matches('textarea')) dispatch('run', ev.target, ev);
  });
  root.addEventListener('change', ev => {
    const a = ev.target.dataset.changeAct;
    if (a) dispatch(a, ev.target, ev);
  });
  root.addEventListener('input', ev => {
    const a = ev.target.dataset.inputAct;
    if (a) dispatch(a, ev.target, ev);
  });
  root.addEventListener('submit', ev => {
    ev.preventDefault();
    const a = ev.target.dataset.submitAct;
    if (a) dispatch(a, ev.target, ev);
  });
  window.addEventListener('hashchange', () => {
    state.switching = false;
    render();
    window.scrollTo(0, 0);
  });
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', render);else setTimeout(render, 0);
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/consola/app.js", error: String((e && e.message) || e) }); }

// ui_kits/consola/automatizaciones.js
try { (() => {
/* Automatizaciones — lista, alta en dos pasos, ejecuciones (CH-12, CH-13, CH-17a/b, CH-21). */
(function () {
  const Z = window.ZD,
    {
      D,
      esc,
      ic,
      badge,
      btn,
      banner,
      field,
      table
    } = Z;
  const fresh = () => ({
    paso: 0,
    cx: null,
    tpl: 'stock_fisico',
    freq: 'diaria',
    hora: '08:00',
    desactivar: null,
    notice: null,
    filtro: '',
    sel: null,
    extra: {}
  });
  let S = fresh();
  const FREQ = {
    diaria: ['Todos los días', '*'],
    'lun-vie': ['Lunes a viernes', '1-5'],
    'lun-sab': ['Lunes a sábado', '1-6'],
    '2h': ['Cada 2 horas', null]
  };
  const cron = () => {
    if (S.freq === '2h') return ['0 */2 * * *', 'Cada 2 horas, a la hora en punto'];
    const [h, m] = S.hora.split(':').map(Number);
    return [`${m} ${h} * * ${FREQ[S.freq][1]}`, `${FREQ[S.freq][0]} a las ${S.hora}`];
  };
  const autos = ctx => (D.automatizaciones[ctx.tenant.id] || []).map(a => Object.assign({}, a, S.extra[a.id] || {}));
  const crumbs = rest => `<a href="#automatizaciones">Automatizaciones</a>${ic('chevron-right')}<span>${rest}</span>`;
  const notifBadge = n => {
    const m = {
      enviada: ['ok', 'mail-check', 'Enviada'],
      'no enviada': ['error', 'mail-x', 'No enviada'],
      'sin datos': ['neutral', 'inbox', 'Sin datos: no se envió'],
      pendiente: ['info', 'clock', 'Pendiente'],
      'no corresponde': ['neutral', 'circle-dashed', 'No corresponde']
    }[n];
    return `<span class="zd-badge${m[0] !== 'neutral' ? ' zd-badge--' + m[0] : ''}">${ic(m[1])}${esc(m[2])}</span>`;
  };
  function lista(ctx) {
    const rows = autos(ctx);
    const cols = [{
      label: 'Automatización',
      html: r => `<span style="display:grid;gap:2px"><b style="font-weight:600">${esc(r.plantilla)}</b><span class="zd-meta zd-mono">${esc(r.id)}</span></span>`
    }, {
      label: 'Conexión',
      key: 'conexion',
      cls: 'is-mono'
    }, {
      label: 'Cron',
      html: r => `<span style="display:grid;gap:2px"><span class="zd-mono" style="font-size:var(--text-xs)">${esc(r.cron)}</span><span class="zd-meta">${esc(r.cronTexto)}</span></span>`
    }, {
      label: 'Estado',
      html: r => badge(r.estado)
    }, {
      label: 'Alta',
      key: 'alta',
      cls: 'is-mono'
    }, {
      label: 'Acciones',
      html: r => `<span style="display:flex;gap:var(--space-2)">${btn('Ver ejecuciones', {
        size: 'sm',
        variant: 'ghost',
        icon: 'activity',
        act: 'ver',
        arg: r.id
      })}${r.estado === 'activa' ? btn('Desactivar', {
        size: 'sm',
        variant: 'ghost',
        icon: 'power',
        act: 'askOff',
        arg: r.id,
        disabled: ctx.frozen
      }) : ''}</span>`
    }];
    return `<section data-change="CH-12 CH-13" data-estado="existe" style="display:grid;gap:var(--space-6)">${Z.pageHead({
      ctx,
      scope: 'tenant',
      title: 'Automatizaciones',
      change: 'CH-12 · CH-13 · CH-21',
      estado: 'EXISTE',
      desc: 'Programadas por cron con el patrón fijo consulta → condición → notificación → registro.',
      actions: btn('Nueva automatización', {
        variant: 'primary',
        icon: 'plus',
        act: 'alta',
        disabled: ctx.frozen
      })
    })}
      ${Z.frozenBanner(ctx)}${S.notice ? banner('ok', esc(S.notice), '', btn('Cerrar aviso', {
      iconOnly: true,
      size: 'sm',
      variant: 'ghost',
      icon: 'x',
      act: 'clearNotice'
    })) : ''}
      ${rows.length ? table(cols, rows, {
      caption: 'Automatizaciones del tenant activo'
    }) : `<div class="zd-card" style="padding:0">${Z.empty('calendar-clock', 'Este tenant no tiene automatizaciones', 'Creá la primera a partir de una plantilla del catálogo.', btn('Nueva automatización', {
      variant: 'primary',
      icon: 'plus',
      act: 'alta',
      disabled: ctx.frozen
    }))}</div>`}</section>
      ${S.desactivar ? Z.dialog(`Desactivar ${esc(S.desactivar)}`, `<p class="zd-dialog__body">Deja de ejecutarse desde ahora. El historial de ejecuciones se conserva y la automatización sigue en la lista como desactivada.</p>`, btn('Cancelar', {
      act: 'cancelOff'
    }) + btn('Desactivar ' + S.desactivar, {
      variant: 'danger',
      icon: 'power',
      act: 'doOff'
    }), {
      closeAct: 'cancelOff'
    }) : ''}`;
  }
  function alta(ctx) {
    const cx = D.conexiones[ctx.tenant.id] || [];
    const sel = S.cx || cx[0] && cx[0].id;
    const steps = ['Conexión y plantilla', 'Parámetros, horario y destinatario'].map((s, i) => `<li class="zd-step${i < S.paso ? ' is-done' : ''}"${i === S.paso ? ' aria-current="step"' : ''}><span class="zd-step__n">${i < S.paso ? ic('check') : i + 1}</span><span>${s}</span></li>`).join('');
    let body;
    if (S.paso === 0) {
      const cards = D.plantillas.map(p => `<label class="zd-template"><input type="radio" name="tpl" value="${esc(p.id)}" data-change-act="tpl"${S.tpl === p.id ? ' checked' : ''}${p.motivo ? ' disabled aria-describedby="why-' + esc(p.id) + '"' : ''}><span class="zd-template__icon">${ic(p.icon)}</span><span class="zd-template__name">${esc(p.nombre)}</span><span class="zd-template__desc">${esc(p.descripcion)}</span><span class="zd-meta">Tolerancia de frescura: ${esc(p.tolerancia)}</span>${p.motivo ? `<span class="zd-template__why" id="why-${esc(p.id)}">${ic('lock')}${esc(p.motivo)}</span>` : ''}<span class="zd-template__check">${ic('circle-check')}</span></label>`).join('');
      body = `<div class="zd-card zd-form">
        <div style="max-width:420px">${field('Conexión', `<select class="zd-select" id="a-cx" data-change-act="cx">${cx.map(c => `<option value="${esc(c.id)}"${c.id === sel ? ' selected' : ''}>${esc(c.id)} · ${esc(c.nombre)}</option>`).join('')}</select>`, {
        id: 'a-cx',
        help: 'La plantilla se valida contra el mapeo de esta conexión.'
      })}</div>
        <fieldset class="zd-templates" data-change="CH-21" data-estado="existe"><legend class="zd-label" style="margin-bottom:var(--space-4)">Plantilla</legend>${cards}</fieldset>
        <div class="zd-form-actions">${btn('Cancelar', {
        variant: 'ghost',
        act: 'cancelAlta'
      })}<span style="flex:1"></span>${btn('Continuar', {
        variant: 'primary',
        act: 'paso',
        arg: 1
      })}</div></div>`;
    } else {
      const p = D.plantillas.find(x => x.id === S.tpl);
      const [expr, txt] = cron();
      body = `<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,360px);gap:var(--space-6);align-items:start">
        <form class="zd-card zd-form" id="f-alta" data-submit-act="crear">
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-4)"><span class="zd-badge">${ic(p.icon)}${esc(p.nombre)}</span><span class="zd-tag">${esc(sel)}</span>${btn('Cambiar', {
        size: 'sm',
        variant: 'ghost',
        act: 'paso',
        arg: 0
      })}</div>
          <fieldset style="border:0;margin:0;padding:0;display:grid;gap:var(--space-5)"><legend class="zd-label" style="margin-bottom:var(--space-4)">Parámetros de la plantilla</legend>
            <div class="zd-form-row">${field('Umbral (:umbral)', `<div class="zd-input-group"><input class="zd-input" type="number" min="1" id="a-u" value="20"><span class="zd-input-suffix">unidades</span></div>`, {
        id: 'a-u'
      })}${field('Depósito (:deposito)', `<input class="zd-input" id="a-d" placeholder="Todos">`, {
        id: 'a-d',
        optional: true
      })}</div></fieldset>
          <div class="zd-form-row">${field('Frecuencia', `<select class="zd-select" id="a-f" data-change-act="freq">${Object.entries(FREQ).map(([k, v]) => `<option value="${k}"${k === S.freq ? ' selected' : ''}>${v[0]}</option>`).join('')}</select>`, {
        id: 'a-f'
      })}${field('Hora', `<input class="zd-input" type="time" id="a-h" value="${esc(S.hora)}" data-input-act="hora"${S.freq === '2h' ? ' disabled' : ''}>`, {
        id: 'a-h'
      })}</div>
          <div class="zd-cron" aria-live="polite">${ic('clock')}<span class="zd-meta">Cron resultante</span><code id="a-cron">${esc(expr)}</code><span id="a-cron-t" class="zd-muted" style="font-size:var(--text-sm)">${esc(txt)}</span></div>
          ${field('Destinatario', `<input class="zd-input" type="email" id="a-to" value="compras@dontito.com.ar">`, {
        id: 'a-to',
        help: 'Un correo. La notificación usa el formato de la plantilla.'
      })}
          <div class="zd-form-actions">${btn('Volver', {
        icon: 'arrow-left',
        act: 'paso',
        arg: 0
      })}<span style="flex:1"></span>${btn('Crear automatización', {
        variant: 'primary',
        icon: 'check',
        type: 'submit'
      })}</div>
        </form>
        <figure style="margin:0;display:grid;gap:var(--space-3)"><figcaption class="zd-label">Vista previa del correo</figcaption><iframe src="../correo/reporte.html" title="Vista previa del correo" style="width:100%;height:520px;border:1px solid var(--border-1);border-radius:var(--radius-lg);background:#f0f2f4"></iframe></figure></div>`;
    }
    return `<section data-change="CH-21" data-estado="existe" style="display:grid;gap:var(--space-6)">${Z.pageHead({
      ctx,
      scope: 'tenant',
      crumbs: crumbs('Nueva'),
      title: 'Nueva automatización',
      change: 'CH-21',
      estado: 'EXISTE'
    })}<ol class="zd-steps" aria-label="Pasos">${steps}</ol>${body}</section>`;
  }
  function ejecuciones(ctx, id) {
    const a = autos(ctx).find(x => x.id === id);
    if (!a) return `<div class="zd-card" style="padding:0">${Z.empty('circle-help', 'No existe esa automatización en este tenant', 'Puede que pertenezca a otro tenant.', btn('Volver a automatizaciones', {
      act: 'back'
    }))}</div>`;
    const rows = D.ejecuciones.filter(e => !S.filtro || e.estado === S.filtro);
    const cols = [{
      label: 'Inicio',
      key: 'inicio',
      cls: 'is-mono'
    }, {
      label: 'Fin',
      key: 'fin',
      cls: 'is-mono'
    }, {
      label: 'Duración',
      key: 'duracion',
      cls: 'is-num'
    }, {
      label: 'Filas',
      key: 'filas',
      cls: 'is-num',
      html: r => r.filas == null ? '—' : esc(r.filas)
    }, {
      label: 'Estado',
      html: r => badge(r.estado, r.estado === 'reintentando' ? `Reintentando (${r.intentos}/3)` : null)
    }, {
      label: 'Notificación',
      html: r => notifBadge(r.notificacion)
    }, {
      label: 'Intentos',
      key: 'intentos',
      cls: 'is-num'
    }, {
      label: 'Error',
      html: r => r.error ? `<span class="zd-meta" style="display:block;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.error)}">${esc(r.error)}</span>` : '—'
    }];
    const e = S.sel && D.ejecuciones.find(x => x.id === S.sel);
    return `<section data-change="CH-13 CH-17a CH-17b" data-estado="existe" style="display:grid;gap:var(--space-6)">${Z.pageHead({
      ctx,
      scope: 'tenant',
      crumbs: crumbs(esc(a.id)),
      title: 'Ejecuciones de ' + a.id,
      change: 'CH-13 · CH-17a · CH-17b',
      estado: 'EXISTE',
      desc: esc(a.plantilla) + ' · ' + esc(a.cronTexto),
      actions: btn('Actualizar', {
        icon: 'refresh-cw',
        act: 'noop'
      })
    })}
      <div class="zd-card"><dl class="zd-kvgrid"><div><dt>Conexión</dt><dd class="zd-mono">${esc(a.conexion)}</dd></div><div><dt>Cron</dt><dd class="zd-mono">${esc(a.cron)}</dd></div><div><dt>Destinatario</dt><dd>${esc(a.destinatario)}</dd></div><div><dt>Estado</dt><dd>${badge(a.estado)}</dd></div></dl></div>
      <div style="display:flex;gap:var(--space-5);align-items:end"><div style="width:240px">${field('Estado', `<select class="zd-select" id="e-f" data-change-act="filtro"><option value="">Todos</option>${['ok', 'fallo', 'omitida', 'interrumpida', 'reintentando'].map(k => `<option value="${k}"${S.filtro === k ? ' selected' : ''}>${{
      ok: 'OK',
      fallo: 'Fallo',
      omitida: 'Omitida por solapamiento',
      interrumpida: 'Interrumpida',
      reintentando: 'Reintentando'
    }[k]}</option>`).join('')}</select>`, {
      id: 'e-f'
    })}</div><span class="zd-meta" style="padding-bottom:8px">${rows.length} de ${D.ejecuciones.length} ejecuciones</span></div>
      ${table(cols, rows, {
      caption: 'Ejecuciones',
      rowAct: 'det',
      selected: S.sel,
      empty: 'No hay ejecuciones con ese estado.'
    })}</section>
      ${e ? Z.drawer(esc(e.id), 'Detalle de la ejecución', `${badge(e.estado)}<dl class="zd-kv"><dt>Inicio</dt><dd class="is-mono">${esc(e.inicio)}</dd><dt>Fin</dt><dd class="is-mono">${esc(e.fin)}</dd><dt>Duración</dt><dd>${esc(e.duracion)}</dd><dt>Filas</dt><dd>${e.filas == null ? '—' : esc(e.filas)}</dd><dt>Intentos</dt><dd>${esc(e.intentos)}</dd><dt>Notificación</dt><dd>${notifBadge(e.notificacion)}</dd></dl>${e.error ? `<div class="zd-field"><span class="zd-label">Error</span><pre class="zd-code" style="margin:0;white-space:pre-wrap">${esc(e.error)}</pre></div>` : ''}`) : ''}`;
  }
  Z.screens.automatizaciones = {
    reset: () => {
      S = fresh();
    },
    render(ctx, sub) {
      if (!ctx.tenant) return Z.pageHead({
        ctx,
        scope: 'tenant',
        title: 'Automatizaciones',
        change: 'CH-12 · CH-13 · CH-21',
        estado: 'EXISTE'
      }) + Z.noTenant('Las automatizaciones');
      if (sub === 'alta') return ctx.frozen ? lista(ctx) : alta(ctx);
      if (sub) return ejecuciones(ctx, sub);
      return lista(ctx);
    },
    on: {
      alta: () => {
        S.paso = 0;
        Z.go('automatizaciones/alta');
        return false;
      },
      cancelAlta: () => {
        Z.go('automatizaciones');
        return false;
      },
      back: () => {
        Z.go('automatizaciones');
        return false;
      },
      paso: el => {
        S.paso = Number(el.dataset.arg);
      },
      cx: el => {
        S.cx = el.value;
        return false;
      },
      tpl: el => {
        S.tpl = el.value;
      },
      freq: el => {
        S.freq = el.value;
      },
      hora: el => {
        S.hora = el.value || '08:00';
        const [e, t] = cron();
        document.getElementById('a-cron').textContent = e;
        document.getElementById('a-cron-t').textContent = t;
        return false;
      },
      crear: () => {
        S.notice = `Se creó la automatización. Primera ejecución: ${cron()[1].toLowerCase()}.`;
        S.paso = 0;
        Z.go('automatizaciones');
        return false;
      },
      ver: el => {
        S.sel = null;
        S.filtro = '';
        Z.go('automatizaciones/' + el.dataset.arg);
        return false;
      },
      askOff: el => {
        S.desactivar = el.dataset.arg;
      },
      cancelOff: () => {
        S.desactivar = null;
      },
      doOff: () => {
        S.extra[S.desactivar] = {
          estado: 'inactiva'
        };
        S.notice = `${S.desactivar} quedó desactivada.`;
        S.desactivar = null;
      },
      filtro: el => {
        S.filtro = el.value;
      },
      det: el => {
        S.sel = el.dataset.arg;
      },
      clearNotice: () => {
        S.notice = null;
      },
      noop: () => false,
      close: () => {
        S.desactivar = null;
        S.sel = null;
      }
    }
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/consola/automatizaciones.js", error: String((e && e.message) || e) }); }

// ui_kits/consola/conexiones.js
try { (() => {
/* Conexiones y agentes (CH-03, CH-19b, CH-19d1, CH-19d2) + pantallas especificadas sin mockup. */
(function () {
  const Z = window.ZD,
    {
      D,
      esc,
      ic,
      badge,
      btn,
      banner,
      field,
      table
    } = Z;
  const fresh = () => ({
    det: null,
    alta: false,
    probando: null,
    prueba: {},
    nuevoAg: false,
    token: null,
    revocar: null,
    revocados: {},
    agExtra: []
  });
  let S = fresh();
  const tabs = (cur, nCx, nAg) => `<div class="zd-tabs" role="tablist" aria-label="Conexiones y agentes">${[['', 'Conexiones', 'cable', nCx], ['agentes', 'Agentes', 'server', nAg]].map(([k, l, i, n]) => `<a class="zd-tab" role="tab" href="#conexiones${k ? '/' + k : ''}" aria-selected="${cur === k}">${ic(i)}${l}<span class="zd-tab__count">${n}</span></a>`).join('')}</div>`;
  const kvgrid = pairs => `<dl class="zd-kvgrid">${pairs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  function pruebaBadge(c) {
    const p = S.prueba[c.id] || c.prueba;
    if (S.probando === c.id) return `<span class="zd-badge zd-badge--info">${ic('loader-circle', 'style="animation:zd-spin 1s linear infinite"')}Probando…</span>`;
    return `<span style="display:grid;gap:2px;justify-items:start">${badge(p.ok ? 'probada' : 'noprobada')}<span class="zd-meta">${esc(p.cuando)}</span></span>`;
  }
  function pruebaDetalle(c) {
    const p = S.prueba[c.id] || c.prueba;
    if (S.probando === c.id) return banner('info', 'Probando la conexión…', '', '', {
      inline: true,
      icon: 'loader-circle'
    });
    return p.ok ? banner('ok', `Conexión OK · ${esc(p.latencia)}`, `${esc(c.motor)} · ${esc(p.tablas)} tablas visibles · usuario de solo lectura. Probada ${esc(p.cuando)}.`, '', {
      inline: true
    }) : banner('error', esc(p.error), `Probada ${esc(p.cuando)}. Revisá usuario y contraseña en el origen.<pre>SQLSTATE ${esc(p.sqlstate)}</pre>`, '', {
      inline: true
    });
  }
  function conexiones(ctx) {
    const cx = D.conexiones[ctx.tenant.id] || [];
    const cols = [{
      label: 'Conexión',
      html: r => `<span style="display:grid;gap:2px"><b style="font-weight:600">${esc(r.nombre)}</b><span class="zd-meta zd-mono">${esc(r.id)}</span></span>`
    }, {
      label: 'Motor',
      key: 'motor'
    }, {
      label: 'Destino',
      html: r => `<span class="zd-mono" style="font-size:var(--text-xs)">${esc(r.host)}${r.puerto ? ':' + esc(r.puerto) : ''}/${esc(r.base)}</span>`
    }, {
      label: 'Usuario',
      key: 'usuario',
      cls: 'is-mono'
    }, {
      label: 'Última prueba',
      html: pruebaBadge
    }, {
      label: 'Acciones',
      html: r => btn('Probar', {
        size: 'sm',
        variant: 'ghost',
        icon: 'plug',
        act: 'probar',
        arg: r.id,
        disabled: ctx.frozen || S.probando === r.id
      })
    }];
    let over = '';
    const c = S.det && cx.find(x => x.id === S.det);
    if (c) over = Z.drawer(esc(c.id), esc(c.nombre), `${pruebaDetalle(c)}<dl class="zd-kv"><dt>Motor</dt><dd>${esc(c.motor)}</dd><dt>Host</dt><dd class="is-mono">${esc(c.host)}</dd><dt>Puerto</dt><dd class="is-mono">${c.puerto == null ? '—' : esc(c.puerto)}</dd><dt>Base</dt><dd class="is-mono">${esc(c.base)}</dd><dt>Usuario</dt><dd class="is-mono">${esc(c.usuario)}</dd><dt>Contraseña</dt><dd><span class="zd-badge">${ic('lock')}Guardada cifrada · no se muestra</span></dd><dt>Alta</dt><dd class="is-mono">${esc(c.alta)}</dd></dl>`, btn('Probar conexión', {
      variant: 'primary',
      icon: 'plug',
      act: 'probar',
      arg: c.id,
      disabled: ctx.frozen
    }));
    if (S.alta) over = Z.drawer('CH-03 · API sin pantalla', 'Nueva conexión', `<form id="f-cx" class="zd-form" data-submit-act="crearCx">${field('Nombre', `<input class="zd-input" id="c-n" name="nombre" placeholder="Réplica principal" autofocus required>`, {
      id: 'c-n'
    })}<div class="zd-form-row">${field('Host', `<input class="zd-input zd-input--code" id="c-h" name="host" required>`, {
      id: 'c-h'
    })}${field('Puerto', `<input class="zd-input" type="number" id="c-p" value="5432">`, {
      id: 'c-p'
    })}</div>${field('Base', `<input class="zd-input zd-input--code" id="c-b">`, {
      id: 'c-b'
    })}${field('Usuario (solo lectura)', `<input class="zd-input zd-input--code" id="c-u" autocomplete="off">`, {
      id: 'c-u'
    })}${field('Contraseña', `<input class="zd-input" type="password" id="c-pw" autocomplete="new-password">`, {
      id: 'c-pw',
      help: 'Se guarda cifrada. Después de guardar no se vuelve a mostrar; para cambiarla, cargá una nueva.'
    })}</form>`, btn('Cancelar', {
      act: 'close'
    }) + btn('Guardar y probar', {
      variant: 'primary',
      icon: 'plug',
      type: 'submit',
      attrs: ' form="f-cx"'
    }));
    return `${cx.length ? table(cols, cx, {
      caption: 'Conexiones del tenant activo',
      rowAct: 'det',
      selected: S.det
    }) : `<div class="zd-card" style="padding:0">${Z.empty('cable', 'Este tenant no tiene conexiones', 'Es el primer paso de la puesta en marcha: sin conexión no hay consultas ni automatizaciones.', btn('Nueva conexión', {
      variant: 'primary',
      icon: 'plus',
      act: 'alta',
      disabled: ctx.frozen
    }))}</div>`}${over}`;
  }
  function agentes(ctx) {
    const ags = (D.agentes[ctx.tenant.id] || []).concat(S.agExtra.filter(a => a.tenant === ctx.tenant.id)).map(a => Object.assign({}, a, S.revocados[a.id] ? {
      revocado: true
    } : {}));
    const riesgo = D.enRiesgo[ctx.tenant.id];
    const cols = [{
      label: 'Agente',
      html: r => `<span style="display:grid;gap:2px"><b style="font-weight:600">${esc(r.nombre)}</b><span class="zd-meta zd-mono">${esc(r.id)}</span></span>`
    }, {
      label: 'Token',
      key: 'token',
      cls: 'is-mono'
    }, {
      label: 'Alta',
      key: 'alta',
      cls: 'is-mono'
    }, {
      label: 'Conectividad',
      html: r => r.revocado ? badge('revocado') : `<span style="display:grid;gap:4px;justify-items:start">${Z.conn(r.estado, r.latido ? 'último latido ' + r.latido : '')}<span class="zd-badge zd-badge--pending" title="Diseño anticipado: CH-19d1">${ic('circle-dashed')}Pendiente</span></span>`
    }, {
      label: 'Acciones',
      html: r => r.revocado ? '' : btn('Revocar', {
        size: 'sm',
        variant: 'ghost',
        icon: 'key-round',
        act: 'askRevoke',
        arg: r.id,
        disabled: ctx.frozen
      })
    }];
    let h = '';
    if (riesgo) h += `<div data-change="CH-19d2" data-estado="pendiente">${banner('warn', `${riesgo.length} automatizaciones en riesgo: el agente no responde hace 3 h`, `<span style="display:block;margin-bottom:var(--space-3)">Si no vuelve antes de su horario, la ejecución va a fallar. <span class="zd-badge zd-badge--pending">${ic('circle-dashed')}Pendiente · CH-19d2</span></span><table class="zd-table zd-table--compact" style="background:var(--surface-card);border-radius:var(--radius-md)"><thead><tr><th scope="col">Automatización</th><th scope="col">Próxima ejecución</th></tr></thead><tbody>${riesgo.map(r => `<tr><td>${esc(r.automatizacion)}</td><td class="is-mono">${esc(r.proxima)}</td></tr>`).join('')}</tbody></table>`)}</div>`;
    if (S.token) h += banner('ok', 'Agente creado. Copiá el token ahora: no se vuelve a mostrar.', `<pre>${esc(S.token)}</pre>`, btn('Copiar token', {
      size: 'sm',
      icon: 'copy',
      act: 'copy'
    }) + btn('Ya lo copié', {
      size: 'sm',
      variant: 'ghost',
      act: 'clearToken'
    }));
    h += ags.length ? table(cols, ags, {
      caption: 'Agentes del tenant activo'
    }) : `<div class="zd-card" style="padding:0">${Z.empty('server', 'Este tenant no tiene agentes', 'Un agente sirve cuando la base del cliente no acepta conexiones entrantes: se conecta desde adentro con un token.', btn('Nuevo agente', {
      variant: 'primary',
      icon: 'plus',
      act: 'askAgent',
      disabled: ctx.frozen
    }))}</div>`;
    if (S.nuevoAg) h += Z.dialog('Nuevo agente', `<form id="f-ag" class="zd-form" data-submit-act="crearAg">${field('Nombre', `<input class="zd-input" id="g-n" name="nombre" placeholder="PC administración" autofocus>`, {
      id: 'g-n',
      help: 'Para reconocerlo en esta lista. El token se muestra una sola vez.'
    })}</form>`, btn('Cancelar', {
      act: 'close'
    }) + btn('Crear agente', {
      variant: 'primary',
      icon: 'key-round',
      type: 'submit',
      attrs: ' form="f-ag"'
    }));
    if (S.revocar) {
      const a = ags.find(x => x.id === S.revocar);
      h += Z.dialog(`Revocar el token de ${esc(a.nombre)}`, `<p class="zd-dialog__body">El agente deja de conectarse de inmediato y el token no se puede reactivar. Las automatizaciones de <b>${esc(ctx.tenant.nombre)}</b> que usen este agente van a fallar hasta que des de alta uno nuevo.</p>`, btn('Cancelar', {
        act: 'close'
      }) + btn('Revocar token', {
        variant: 'danger',
        icon: 'key-round',
        act: 'doRevoke'
      }));
    }
    return h;
  }
  Z.screens.conexiones = {
    reset: () => {
      S = fresh();
    },
    render(ctx, sub) {
      const isAg = sub === 'agentes';
      const head = Z.pageHead({
        ctx,
        scope: 'tenant',
        title: 'Conexiones y agentes',
        change: isAg ? 'CH-19b · CH-19d1 · CH-19d2' : 'CH-03',
        estado: isAg ? 'API · conectividad PENDIENTE' : 'API sin pantalla',
        desc: 'Cómo llega ZeroDashboard a la réplica del tenant: conexión directa de solo lectura o agente saliente instalado en el cliente.',
        actions: isAg ? btn('Nuevo agente', {
          variant: 'primary',
          icon: 'plus',
          act: 'askAgent',
          disabled: !ctx.tenant || ctx.frozen
        }) : btn('Nueva conexión', {
          variant: 'primary',
          icon: 'plus',
          act: 'alta',
          disabled: !ctx.tenant || ctx.frozen
        })
      });
      if (!ctx.tenant) return head + Z.noTenant('Las conexiones y los agentes');
      return `<section data-change="${isAg ? 'CH-19b CH-19d1 CH-19d2' : 'CH-03'}" data-estado="${isAg ? 'pendiente' : 'parcial'}" style="display:grid;gap:var(--space-6)">${head}${Z.frozenBanner(ctx)}${tabs(isAg ? 'agentes' : '', (D.conexiones[ctx.tenant.id] || []).length, (D.agentes[ctx.tenant.id] || []).length + S.agExtra.filter(a => a.tenant === ctx.tenant.id).length)}${isAg ? agentes(ctx) : conexiones(ctx)}</section>`;
    },
    on: {
      det: el => {
        S.det = el.dataset.arg;
        S.alta = false;
      },
      alta: () => {
        S.alta = true;
        S.det = null;
      },
      crearCx: f => {
        if (!f.elements.nombre.value.trim()) {
          f.elements.nombre.setAttribute('aria-invalid', 'true');
          f.elements.nombre.focus();
          return false;
        }
        S.alta = false;
      },
      probar: el => {
        const id = el.dataset.arg;
        S.probando = id;
        setTimeout(() => {
          S.probando = null;
          S.prueba[id] = {
            ok: true,
            cuando: 'recién',
            latencia: '44 ms',
            tablas: 38
          };
          Z.render();
        }, 900);
      },
      askAgent: () => {
        S.nuevoAg = true;
      },
      crearAg: (f, ctx) => {
        const n = f.elements.nombre.value.trim() || 'Agente sin nombre';
        S.agExtra.push({
          id: 'ag_' + (10 + S.agExtra.length),
          tenant: ctx.tenant.id,
          nombre: n,
          token: 'zd_ag_••••7c1e',
          alta: '09/10 11:05',
          estado: 'sin_datos',
          latido: null
        });
        S.token = 'zd_ag_5Qm2r8Kx-7c1e-Rk9pW3sd-03bdT6';
        S.nuevoAg = false;
      },
      copy: () => {
        navigator.clipboard && navigator.clipboard.writeText(S.token);
        return false;
      },
      clearToken: () => {
        S.token = null;
      },
      askRevoke: el => {
        S.revocar = el.dataset.arg;
      },
      doRevoke: () => {
        S.revocados[S.revocar] = true;
        S.revocar = null;
      },
      close: () => {
        S.det = null;
        S.alta = false;
        S.nuevoAg = false;
        S.revocar = null;
      }
    }
  };
  const SPEC = {
    tenants: ['Tenants', 'global', 'Sin change de UI', 'API sin pantalla', 'Alta, listado y baja lógica de tenants. La baja congela todo y se confirma con «Dar de baja {nombre}».', 'C-02'],
    plantillas: ['Plantillas', 'global', 'CH-21 · CH-24', 'API sin pantalla', 'Catálogo de plantillas con su descripción, campos requeridos y tolerancia de frescura. Solo lectura.', 'C-03'],
    contrato: ['Contrato canónico', 'global', 'CH-08', 'API sin pantalla', 'Entidades, campos, tipos y dependencias que las plantillas esperan. Solo lectura.', 'C-04'],
    mapeo: ['Mapeo y validación', 'tenant', 'CH-09 · CH-10', 'API sin pantalla', 'Mapeo del esquema del tenant al contrato canónico y validación, con entidades inaplicables y su motivo.', 'C-06'],
    tiempos: ['Tiempos de alta', 'tenant', 'CH-15', 'API sin pantalla', 'Marcas de tiempo por etapa: alta, conexión, mapeo, validación, primera automatización, primera ejecución.', 'C-07'],
    frescura: ['Frescura de datos', 'tenant', 'CH-24', 'EXISTE', 'Ventana de desactualización, última actualización de la réplica, «Marcar réplica actualizada ahora» y tolerancia por plantilla.', 'C-11'],
    auditoria: ['Auditoría', 'tenant', 'Sin change', 'PENDIENTE', 'Registro de ejecuciones de consultas: qué, cuándo, contra qué tenant y, cuando exista, quién.', 'C-12']
  };
  Z.screens._spec = {
    render(ctx, sub, id) {
      const s = SPEC[id] || ['Pantalla no encontrada', 'global', '', '', 'Esta dirección no corresponde a ninguna pantalla de la consola.', ''];
      return `<section data-change="${esc(s[2])}" data-estado="${esc(s[3]).toLowerCase()}" style="display:grid;gap:var(--space-6)">${Z.pageHead({
        ctx,
        scope: s[1],
        title: s[0],
        change: s[2],
        estado: s[3],
        desc: esc(s[4])
      })}${s[1] === 'tenant' && ctx.tenant ? Z.frozenBanner(ctx) : ''}<div class="zd-card" style="padding:0">${Z.empty('file-text', 'Especificada, fuera de este mockup', `Datos, estados y acciones en <span class="zd-mono">guidelines/consola.md</span> (${esc(s[5])}). Se compone con DataTable, Field, Banner, StatusBadge y KeyValueList.`)}</div></section>`;
    }
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/consola/conexiones.js", error: String((e && e.message) || e) }); }

// ui_kits/consola/consultas.js
try { (() => {
/* Consultas — editor + resultado + guardadas con versiones (CH-04, CH-05, CH-11, CH-25). */
(function () {
  const Z = window.ZD,
    {
      D,
      esc,
      ic,
      badge,
      btn,
      banner,
      field,
      table
    } = Z;
  const fresh = () => ({
    loaded: 'q_31',
    sql: D.sql,
    params: D.parametros.map(p => Object.assign({}, p)),
    perPage: 25,
    sim: 'ok',
    run: 'ok',
    page: 1,
    drawer: false,
    compare: null,
    restore: null,
    save: null,
    notice: null,
    versiones: D.versiones.map(v => Object.assign({}, v))
  });
  let S = fresh();
  const vig = () => S.versiones[0];
  function resultado(ctx) {
    if (S.run === 'running') return `<div class="zd-card" style="padding:0"><div class="zd-state" role="status"><span class="zd-spinner" aria-hidden="true"></span><p class="zd-state__body">Ejecutando consulta…</p></div></div>`;
    if (S.run === null) return `<div class="zd-card" style="padding:0">${Z.empty('play', 'Todavía no ejecutaste esta consulta', 'El resultado aparece acá, justo debajo del editor.')}</div>`;
    if (S.run === 'error') return banner('error', 'Error de sintaxis cerca de «FORM»', 'Revisá la línea 3: probablemente quisiste escribir <span class="zd-mono">FROM</span>.<pre>SQLSTATE 42601 · línea 3, columna 1</pre>');
    if (S.run === 'escritura') return banner('error', 'Solo se permiten consultas de lectura', 'Se encontró <span class="zd-mono">UPDATE</span> en la línea 1. La conexión es de solo lectura: usá <span class="zd-mono">SELECT</span> o <span class="zd-mono">WITH … SELECT</span>.<pre>SQLSTATE 25006</pre>');
    if (S.run === 'timeout') return banner('error', 'La consulta superó el tiempo máximo (30 s)', 'La réplica no respondió a tiempo. Probá acotar el rango o filtrar por una columna indexada.<pre>SQLSTATE 57014</pre>', btn('Reintentar', {
      size: 'sm',
      icon: 'refresh-cw',
      act: 'run'
    }));
    const rows = S.run === 'vacio' ? [] : D.resultado;
    const tope = S.run === 'tope';
    const total = tope ? 1000 : rows.length;
    const pages = Math.max(1, Math.ceil(total / S.perPage));
    const cols = [{
      key: 'sku',
      label: 'sku',
      cls: 'is-mono'
    }, {
      key: 'nombre',
      label: 'nombre'
    }, {
      key: 'deposito',
      label: 'deposito'
    }, {
      key: 'stock_actual',
      label: 'stock_actual',
      cls: 'is-num'
    }, {
      key: 'stock_minimo',
      label: 'stock_minimo',
      cls: 'is-num'
    }];
    const status = `<div class="zd-statusline" role="status">${ic('circle-check', 'style="color:var(--ok)"')}<b style="color:var(--text-1)">${total.toLocaleString('es-AR')} filas</b><span class="zd-statusline__sep"></span><span class="zd-num">1,8 s</span><span class="zd-statusline__sep"></span><span>conexión <span class="zd-mono">cx_01</span></span>${tope ? `<span class="zd-statusline__sep"></span><span class="zd-badge zd-badge--warn">${ic('triangle-alert')}Cortado en el tope (1.000 filas)</span>` : ''}</div>`;
    const foot = `<div class="zd-pager"><span class="zd-num">${total ? (S.page - 1) * S.perPage + 1 : 0}–${Math.min(S.page * S.perPage, total)} de ${total.toLocaleString('es-AR')}</span><span class="zd-pager__spacer"></span>${btn('Página anterior', {
      iconOnly: true,
      size: 'sm',
      icon: 'chevron-left',
      act: 'page',
      arg: S.page - 1,
      disabled: S.page <= 1
    })}<span class="zd-num">Página ${S.page} de ${pages}</span>${btn('Página siguiente', {
      iconOnly: true,
      size: 'sm',
      icon: 'chevron-right',
      act: 'page',
      arg: S.page + 1,
      disabled: S.page >= pages
    })}</div>`;
    return `<div style="display:grid;gap:var(--space-4)">${status}${table(cols, rows, {
      caption: 'Resultado de la consulta',
      empty: 'La consulta no devolvió filas.',
      foot
    })}</div>`;
  }
  function editor(ctx) {
    const q = D.guardadas.find(x => x.id === S.loaded);
    const cx = D.conexiones[ctx.tenant.id] || [];
    const ctxStrip = q ? `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-4)"><span style="font-weight:600">${esc(q.nombre)}</span>${badge('vigente', 'Versión ' + vig().v + ' · vigente')}<span style="flex:1"></span>${btn('Guardar como nueva versión', {
      size: 'sm',
      icon: 'save',
      act: 'openSave',
      arg: 'version',
      disabled: ctx.frozen
    })}${btn('Versiones', {
      size: 'sm',
      icon: 'history',
      variant: 'ghost',
      act: 'versiones',
      attrs: ` aria-pressed="${S.drawer}"`
    })}</div>` : `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-4)"><span class="zd-muted">Consulta sin guardar</span><span style="flex:1"></span>${btn('Guardar consulta', {
      size: 'sm',
      icon: 'save',
      act: 'openSave',
      arg: 'nueva',
      disabled: ctx.frozen
    })}</div>`;
    const params = S.params.map((p, i) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 130px minmax(0,1fr) auto;gap:var(--space-4);align-items:end">
      ${field(i === 0 ? 'Nombre' : 'Nombre', `<input class="zd-input zd-input--code" id="pn${i}" value="${esc(p.nombre)}" data-input-act="param" data-arg="${i}" data-k="nombre">`, {
      id: 'pn' + i
    })}
      ${field('Tipo', `<select class="zd-select" id="pt${i}" data-change-act="param" data-arg="${i}" data-k="tipo">${['entero', 'decimal', 'texto', 'fecha', 'booleano'].map(t => `<option${t === p.tipo ? ' selected' : ''}>${t}</option>`).join('')}</select>`, {
      id: 'pt' + i
    })}
      ${field('Valor', `<input class="zd-input" id="pv${i}" value="${esc(p.valor)}" placeholder="NULL" data-input-act="param" data-arg="${i}" data-k="valor">`, {
      id: 'pv' + i
    })}
      ${btn('Quitar :' + p.nombre, {
      iconOnly: true,
      icon: 'trash-2',
      variant: 'ghost',
      act: 'delParam',
      arg: i
    })}</div>`).join('');
    return `<div class="zd-card zd-form" data-change="CH-04 CH-11" data-estado="existe">
      ${ctxStrip}
      <div class="zd-form-row">
        ${field('Conexión', `<select class="zd-select" id="q-cx">${cx.map(c => `<option value="${esc(c.id)}">${esc(c.id)} · ${esc(c.nombre)}</option>`).join('')}</select>`, {
      id: 'q-cx'
    })}
        ${field('Filas por página', `<select class="zd-select" id="q-pp" data-change-act="perPage">${[25, 50, 100].map(n => `<option${n === S.perPage ? ' selected' : ''}>${n}</option>`).join('')}</select>`, {
      id: 'q-pp'
    })}
      </div>
      ${field('SQL (solo lectura)', `<textarea class="zd-textarea zd-textarea--code" id="q-sql" rows="7" spellcheck="false" data-input-act="sql" aria-describedby="q-sql-h">${esc(S.sql)}</textarea>`, {
      id: 'q-sql',
      help: 'Parámetros con dos puntos (:umbral). Ctrl + Enter ejecuta. Tope: 1.000 filas · 30 s.'
    })}
      <fieldset style="border:0;margin:0;padding:0;display:grid;gap:var(--space-4)"><legend class="zd-label" style="margin-bottom:var(--space-3)">Parámetros declarados</legend>${params}<div>${btn('Agregar parámetro', {
      size: 'sm',
      icon: 'plus',
      variant: 'ghost',
      act: 'addParam'
    })}</div></fieldset>
      <div class="zd-form-actions">${btn('Ejecutar', {
      variant: 'primary',
      icon: 'play',
      act: 'run',
      disabled: ctx.frozen || S.run === 'running'
    })}<span class="zd-meta">Ctrl + Enter</span><span style="flex:1"></span>
        <label class="zd-meta" style="display:flex;gap:var(--space-3);align-items:center">Mockup: simular resultado <select class="zd-select" style="width:160px;min-height:28px" data-change-act="sim">${[['ok', 'Éxito'], ['tope', 'Cortado en el tope'], ['vacio', 'Sin filas'], ['error', 'Error de sintaxis'], ['escritura', 'Sentencia de escritura'], ['timeout', 'Timeout']].map(([v, l]) => `<option value="${v}"${v === S.sim ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
    </div>`;
  }
  function guardadas(ctx) {
    return `<aside data-change="CH-05" data-estado="existe" style="display:grid;gap:var(--space-4)" aria-label="Consultas guardadas"><span class="zd-eyebrow">Guardadas (${D.guardadas.length})</span><ul class="zd-list">${D.guardadas.map(q => `<li><button class="zd-list__item" data-act="load" data-arg="${esc(q.id)}"${S.loaded === q.id ? ' aria-current="true"' : ''}><span style="font-weight:600;font-size:var(--text-sm)">${esc(q.nombre)}</span><span class="zd-meta">${esc(q.descripcion)}</span><span class="zd-meta">v${esc(q.vigente)} · ${esc(q.editada)}</span></button></li>`).join('')}</ul>${btn('Consulta nueva', {
      size: 'sm',
      icon: 'plus',
      variant: 'ghost',
      act: 'nueva'
    })}</aside>`;
  }
  function overlays(ctx) {
    let h = '';
    if (S.drawer) {
      const list = S.versiones.map((v, i) => `<li style="display:grid;grid-template-columns:auto minmax(0,1fr);gap:var(--space-2) var(--space-4);padding:var(--space-4);border-radius:var(--radius-md);${i === 0 ? 'background:var(--surface-selected)' : 'border:1px solid var(--border-1)'}"><span class="zd-tag">v${v.v}</span><span style="display:grid;gap:2px"><span style="font-size:var(--text-sm);font-weight:600">${v.nota ? esc(v.nota) : '<span class="zd-muted" style="font-weight:400">Sin nota</span>'}</span><span class="zd-meta">${esc(v.fecha)}</span></span><span></span><span style="display:flex;flex-wrap:wrap;gap:var(--space-3)">${i === 0 ? badge('vigente') : btn('Comparar con la actual', {
        size: 'sm',
        icon: 'columns-2',
        act: 'compare',
        arg: v.v
      }) + btn('Restaurar', {
        size: 'sm',
        variant: 'ghost',
        icon: 'rotate-ccw',
        act: 'askRestore',
        arg: v.v,
        disabled: ctx.frozen
      })}</span></li>`).join('');
      h += Z.drawer('CH-25 · Stock bajo por depósito', 'Versiones', `<ol class="zd-list" style="gap:var(--space-3)">${list}</ol><p class="zd-meta" style="margin:0">Restaurar crea una versión nueva con el texto elegido. Ninguna versión se borra.</p>`);
    }
    if (S.compare) {
      const v = S.versiones.find(x => x.v === S.compare);
      h += Z.drawer('Comparación de texto (sin diff)', `Versión ${v.v} y versión vigente`, `<div class="zd-compare"><figure><figcaption>${ic('history')}Versión ${v.v} · ${esc(v.fecha)}</figcaption><pre class="zd-code" style="margin:0">${esc(v.sql || S.sql)}</pre></figure><figure><figcaption>${ic('circle-check')}Vigente · versión ${vig().v}</figcaption><pre class="zd-code" style="margin:0">${esc(vig().sql || S.sql)}</pre></figure></div>`, btn('Volver a versiones', {
        icon: 'arrow-left',
        act: 'closeCompare'
      }) + btn('Restaurar versión ' + v.v, {
        variant: 'primary',
        icon: 'rotate-ccw',
        act: 'askRestore',
        arg: v.v,
        disabled: ctx.frozen
      }), {
        wide: true,
        closeAct: 'closeCompare'
      });
    }
    if (S.restore) {
      const n = vig().v + 1;
      h += Z.dialog(`Restaurar la versión ${S.restore}`, `<p class="zd-dialog__body">Se crea la versión ${n} con el texto de la versión ${S.restore} y pasa a ser la vigente. Las versiones anteriores se conservan.</p>`, btn('Cancelar', {
        act: 'cancelRestore'
      }) + btn('Restaurar versión ' + S.restore, {
        variant: 'primary',
        icon: 'rotate-ccw',
        act: 'doRestore'
      }), {
        closeAct: 'cancelRestore'
      });
    }
    if (S.save === 'version') h += Z.dialog(`Guardar como versión ${vig().v + 1}`, `<form id="f-ver" data-submit-act="doSave" class="zd-form">${field('Nota', `<input class="zd-input" id="v-nota" name="nota" placeholder="Qué cambió" autofocus>`, {
      id: 'v-nota',
      optional: true,
      help: 'Aparece en el historial de versiones.'
    })}</form>`, btn('Cancelar', {
      act: 'cancelSave'
    }) + btn(`Guardar versión ${vig().v + 1}`, {
      variant: 'primary',
      icon: 'save',
      type: 'submit',
      attrs: ' form="f-ver"'
    }), {
      closeAct: 'cancelSave'
    });
    if (S.save === 'nueva') h += Z.dialog('Guardar consulta', `<form id="f-new" data-submit-act="doSave" class="zd-form">${field('Nombre', `<input class="zd-input" id="n-nom" name="nombre" required autofocus>`, {
      id: 'n-nom'
    })}${field('Descripción', `<input class="zd-input" id="n-desc" name="descripcion">`, {
      id: 'n-desc',
      optional: true
    })}</form>`, btn('Cancelar', {
      act: 'cancelSave'
    }) + btn('Guardar consulta', {
      variant: 'primary',
      icon: 'save',
      type: 'submit',
      attrs: ' form="f-new"'
    }), {
      closeAct: 'cancelSave'
    });
    return h;
  }
  Z.screens.consultas = {
    reset: () => {
      S = fresh();
    },
    render(ctx) {
      const head = Z.pageHead({
        ctx,
        scope: 'tenant',
        title: 'Consultas',
        change: 'CH-04 · CH-05 · CH-11 · CH-25',
        estado: 'EXISTE',
        desc: 'SQL de solo lectura sobre una conexión del tenant activo. El resultado aparece debajo del editor.'
      });
      if (!ctx.tenant) return head + Z.noTenant('Las conexiones y las consultas guardadas');
      return `<section data-change="CH-04 CH-05 CH-11 CH-25" data-estado="existe" style="display:grid;gap:var(--space-8)">${head}${Z.frozenBanner(ctx)}${S.notice ? banner('ok', esc(S.notice), '', btn('Cerrar aviso', {
        iconOnly: true,
        size: 'sm',
        variant: 'ghost',
        icon: 'x',
        act: 'clearNotice'
      })) : ''}
        <div class="zd-split">${guardadas(ctx)}<div style="display:grid;gap:var(--space-6);min-width:0">${editor(ctx)}<section aria-label="Resultado" aria-live="polite" id="q-result">${resultado(ctx)}</section></div></div></section>${overlays(ctx)}`;
    },
    on: {
      run: (el, ctx) => {
        if (ctx.frozen) return false;
        S.run = 'running';
        S.page = 1;
        setTimeout(() => {
          S.run = S.sim;
          Z.render();
          document.getElementById('q-result')?.focus?.();
        }, 600);
      },
      sim: el => {
        S.sim = el.value;
        S.run = el.value;
        S.page = 1;
      },
      page: el => {
        S.page = Number(el.dataset.arg);
      },
      perPage: el => {
        S.perPage = Number(el.value);
        S.page = 1;
      },
      sql: el => {
        S.sql = el.value;
        return false;
      },
      param: el => {
        S.params[el.dataset.arg][el.dataset.k] = el.value;
        return el.tagName === 'SELECT' ? undefined : false;
      },
      addParam: () => {
        S.params.push({
          nombre: 'nuevo',
          tipo: 'texto',
          valor: ''
        });
      },
      delParam: el => {
        S.params.splice(Number(el.dataset.arg), 1);
      },
      load: el => {
        S.loaded = el.dataset.arg;
        S.sql = D.sql;
        S.run = null;
        S.drawer = false;
      },
      nueva: () => {
        S.loaded = null;
        S.sql = '';
        S.params = [];
        S.run = null;
        S.drawer = false;
      },
      versiones: () => {
        S.drawer = !S.drawer;
        S.compare = null;
      },
      compare: el => {
        S.compare = Number(el.dataset.arg);
      },
      closeCompare: () => {
        S.compare = null;
      },
      askRestore: el => {
        S.restore = Number(el.dataset.arg);
      },
      cancelRestore: () => {
        S.restore = null;
      },
      doRestore: () => {
        const n = vig().v + 1,
          src = S.versiones.find(x => x.v === S.restore);
        S.versiones[0].sql = S.versiones[0].sql || S.sql;
        S.versiones.unshift({
          v: n,
          fecha: '09/10 11:02',
          nota: 'Restaurada desde la versión ' + S.restore,
          sql: src.sql
        });
        S.sql = src.sql;
        S.notice = `Se creó la versión ${n} a partir de la versión ${S.restore}.`;
        S.restore = null;
        S.compare = null;
      },
      openSave: el => {
        S.save = el.dataset.arg;
      },
      cancelSave: () => {
        S.save = null;
      },
      doSave: form => {
        if (S.save === 'version') {
          const n = vig().v + 1;
          S.versiones[0].sql = S.versiones[0].sql || S.sql;
          S.versiones.unshift({
            v: n,
            fecha: '09/10 11:00',
            nota: form.elements.nota.value,
            sql: S.sql
          });
          S.notice = `Guardaste la versión ${n}. Es la vigente.`;
        } else {
          if (!form.elements.nombre.value.trim()) {
            form.elements.nombre.setAttribute('aria-invalid', 'true');
            form.elements.nombre.focus();
            return false;
          }
          S.notice = `Guardaste «${form.elements.nombre.value}».`;
        }
        S.save = null;
      },
      clearNotice: () => {
        S.notice = null;
      },
      close: () => {
        if (S.restore) S.restore = null;else if (S.save) S.save = null;else if (S.compare) S.compare = null;else S.drawer = false;
      }
    }
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/consola/consultas.js", error: String((e && e.message) || e) }); }

// ui_kits/consola/datos-consola.js
try { (() => {
/* DATOS DE MUESTRA — consola. Reemplazables sin tocar el diseño. */
window.DATOS_CONSOLA = {
  tenants: [{
    id: 'ten_7f3a',
    nombre: 'Almacén Don Tito',
    estado: 'activo',
    alta: '12/09/2026',
    agente: 'conectado',
    latido: 'hace 12 s'
  }, {
    id: 'ten_2c91',
    nombre: 'Panadería La Espiga',
    estado: 'activo',
    alta: '20/09/2026',
    agente: 'desconectado',
    latido: 'hace 3 h'
  }, {
    id: 'ten_b044',
    nombre: 'Dietética Raíces',
    estado: 'baja',
    alta: '02/10/2026',
    baja: '07/10/2026',
    agente: 'sin_datos',
    latido: null
  }],
  conexiones: {
    ten_7f3a: [{
      id: 'cx_01',
      nombre: 'Réplica principal',
      motor: 'PostgreSQL 15.4',
      host: 'replica.dontito.local',
      puerto: 5432,
      base: 'tienda',
      usuario: 'zd_lectura',
      alta: '12/09 10:14',
      prueba: {
        ok: true,
        cuando: 'hoy 08:12',
        latencia: '42 ms',
        tablas: 38
      }
    }, {
      id: 'cx_02',
      nombre: 'Réplica sucursal norte',
      motor: 'MySQL 8.0',
      host: '10.0.4.12',
      puerto: 3306,
      base: 'norte',
      usuario: 'zd_ro',
      alta: '18/09 16:40',
      prueba: {
        ok: false,
        cuando: 'ayer 19:02',
        error: 'Acceso denegado para el usuario "zd_ro"',
        sqlstate: '28000'
      }
    }],
    ten_2c91: [{
      id: 'cx_07',
      nombre: 'Agente PC administración',
      motor: 'PostgreSQL 14.9',
      host: 'vía agente',
      puerto: null,
      base: 'espiga',
      usuario: 'lector',
      alta: '20/09 12:01',
      prueba: {
        ok: true,
        cuando: 'hoy 05:40',
        latencia: '180 ms',
        tablas: 21
      }
    }],
    ten_b044: [{
      id: 'cx_11',
      nombre: 'Réplica',
      motor: 'PostgreSQL 15.2',
      host: 'db.raices.com.ar',
      puerto: 5432,
      base: 'raices',
      usuario: 'zd',
      alta: '02/10 09:30',
      prueba: {
        ok: true,
        cuando: '06/10 18:00',
        latencia: '61 ms',
        tablas: 17
      }
    }]
  },
  agentes: {
    ten_7f3a: [{
      id: 'ag_01',
      nombre: 'Servidor local tienda',
      token: 'zd_ag_••••8f2c',
      alta: '12/09 10:02',
      estado: 'conectado',
      latido: 'hace 12 s',
      revocado: false
    }],
    ten_2c91: [{
      id: 'ag_02',
      nombre: 'PC administración',
      token: 'zd_ag_••••a17e',
      alta: '20/09 11:48',
      estado: 'desconectado',
      latido: 'hace 3 h',
      revocado: false
    }],
    ten_b044: []
  },
  enRiesgo: {
    ten_2c91: [{
      automatizacion: 'au_21 · Alerta de stock físico',
      proxima: '09/10 16:00'
    }, {
      automatizacion: 'au_22 · Reporte diario',
      proxima: '10/10 07:00'
    }]
  },
  sql: 'SELECT p.sku, p.nombre, p.deposito,\n       p.stock_actual, p.stock_minimo\nFROM productos p\nWHERE p.stock_actual < :umbral\n  AND (:deposito IS NULL OR p.deposito = :deposito)\nORDER BY p.stock_actual ASC;',
  parametros: [{
    nombre: 'umbral',
    tipo: 'entero',
    valor: '25'
  }, {
    nombre: 'deposito',
    tipo: 'texto',
    valor: ''
  }],
  resultado: [{
    sku: 'ALM-0201',
    nombre: 'Fideos tirabuzón 500 g',
    deposito: 'Central',
    stock_actual: 0,
    stock_minimo: 40
  }, {
    sku: 'ALM-0103',
    nombre: 'Harina 000 1 kg',
    deposito: 'Sucursal Norte',
    stock_actual: 3,
    stock_minimo: 30
  }, {
    sku: 'ALM-0012',
    nombre: 'Yerba mate 1 kg',
    deposito: 'Central',
    stock_actual: 8,
    stock_minimo: 20
  }, {
    sku: 'ALM-0150',
    nombre: 'Dulce de leche 400 g',
    deposito: 'Central',
    stock_actual: 11,
    stock_minimo: 12
  }, {
    sku: 'ALM-0047',
    nombre: 'Aceite de girasol 1,5 L',
    deposito: 'Central',
    stock_actual: 14,
    stock_minimo: 24
  }, {
    sku: 'ALM-0188',
    nombre: 'Arroz largo fino 1 kg',
    deposito: 'Sucursal Norte',
    stock_actual: 19,
    stock_minimo: 25
  }, {
    sku: 'ALM-0233',
    nombre: 'Tomate triturado 520 g',
    deposito: 'Central',
    stock_actual: 22,
    stock_minimo: 30
  }, {
    sku: 'ALM-0290',
    nombre: 'Galletitas de agua 3x',
    deposito: 'Sucursal Norte',
    stock_actual: null,
    stock_minimo: 18
  }],
  guardadas: [{
    id: 'q_31',
    nombre: 'Stock bajo por depósito',
    descripcion: 'Productos por debajo del mínimo, por depósito.',
    vigente: 4,
    editada: '02/10 18:40'
  }, {
    id: 'q_28',
    nombre: 'Ventas del día',
    descripcion: 'Pedidos confirmados de las últimas 24 h.',
    vigente: 2,
    editada: '28/09 10:05'
  }, {
    id: 'q_19',
    nombre: 'Insumos para producción',
    descripcion: 'Insumos y rendimiento por receta.',
    vigente: 7,
    editada: '21/09 16:22'
  }],
  versiones: [{
    v: 4,
    fecha: '02/10 18:40',
    nota: 'Agrega filtro por depósito',
    sql: null
  }, {
    v: 3,
    fecha: '30/09 09:12',
    nota: 'Parámetro :umbral',
    sql: 'SELECT p.sku, p.nombre,\n       p.stock_actual, p.stock_minimo\nFROM productos p\nWHERE p.stock_actual < :umbral\nORDER BY p.stock_actual ASC;'
  }, {
    v: 2,
    fecha: '25/09 15:01',
    nota: 'Ordena por stock',
    sql: 'SELECT p.sku, p.nombre, p.stock_actual\nFROM productos p\nWHERE p.stock_actual < p.stock_minimo\nORDER BY p.stock_actual ASC;'
  }, {
    v: 1,
    fecha: '24/09 11:30',
    nota: '',
    sql: 'SELECT sku, nombre, stock_actual\nFROM productos\nWHERE stock_actual < stock_minimo;'
  }],
  plantillas: [{
    id: 'stock_fisico',
    nombre: 'Alerta de stock físico',
    descripcion: 'Avisa cuando un producto queda por debajo del mínimo.',
    icon: 'package',
    tolerancia: '1 h'
  }, {
    id: 'stock_producible',
    nombre: 'Alerta de stock producible',
    descripcion: 'Avisa cuando los insumos no alcanzan para producir.',
    icon: 'boxes',
    tolerancia: '2 h',
    motivo: 'El mapeo marca «receta» como inaplicable para este tenant.'
  }, {
    id: 'reporte_diario',
    nombre: 'Reporte diario',
    descripcion: 'Resumen del día enviado por correo a la mañana.',
    icon: 'file-text',
    tolerancia: '24 h'
  }],
  automatizaciones: {
    ten_7f3a: [{
      id: 'au_11',
      plantilla: 'Alerta de stock físico',
      conexion: 'cx_01',
      cron: '0 8 * * *',
      cronTexto: 'Todos los días a las 08:00',
      estado: 'activa',
      alta: '14/09 11:20',
      destinatario: 'compras@dontito.com.ar'
    }, {
      id: 'au_12',
      plantilla: 'Reporte diario',
      conexion: 'cx_01',
      cron: '30 7 * * 1-6',
      cronTexto: 'Lunes a sábado a las 07:30',
      estado: 'activa',
      alta: '15/09 09:02',
      destinatario: 'tito@dontito.com.ar'
    }, {
      id: 'au_13',
      plantilla: 'Alerta de stock físico',
      conexion: 'cx_02',
      cron: '0 */2 * * *',
      cronTexto: 'Cada 2 horas',
      estado: 'inactiva',
      alta: '19/09 17:45',
      destinatario: 'norte@dontito.com.ar'
    }],
    ten_2c91: [{
      id: 'au_21',
      plantilla: 'Alerta de stock físico',
      conexion: 'cx_07',
      cron: '0 */4 * * *',
      cronTexto: 'Cada 4 horas',
      estado: 'activa',
      alta: '21/09 10:00',
      destinatario: 'compras@laespiga.com.ar'
    }, {
      id: 'au_22',
      plantilla: 'Reporte diario',
      conexion: 'cx_07',
      cron: '0 7 * * *',
      cronTexto: 'Todos los días a las 07:00',
      estado: 'activa',
      alta: '21/09 10:05',
      destinatario: 'duenia@laespiga.com.ar'
    }],
    ten_b044: [{
      id: 'au_31',
      plantilla: 'Reporte diario',
      conexion: 'cx_11',
      cron: '0 8 * * *',
      cronTexto: 'Todos los días a las 08:00',
      estado: 'inactiva',
      alta: '03/10 12:00',
      destinatario: 'raices@raices.com.ar'
    }]
  },
  ejecuciones: [{
    id: 'ej_9046',
    inicio: '09/10 08:00:02',
    fin: '09/10 08:00:04',
    duracion: '1,8 s',
    filas: 3,
    estado: 'ok',
    notificacion: 'enviada',
    intentos: 1,
    error: null
  }, {
    id: 'ej_9045',
    inicio: '08/10 08:00:00',
    fin: '08/10 08:00:41',
    duracion: '41,2 s',
    filas: 3,
    estado: 'reintentando',
    notificacion: 'pendiente',
    intentos: 2,
    error: 'Se canceló la consulta por tiempo máximo (30 s). SQLSTATE 57014'
  }, {
    id: 'ej_9044',
    inicio: '07/10 10:00:00',
    fin: '—',
    duracion: '—',
    filas: null,
    estado: 'omitida',
    notificacion: 'no corresponde',
    intentos: 0,
    error: 'La ejecución anterior seguía en curso.'
  }, {
    id: 'ej_9043',
    inicio: '07/10 08:00:01',
    fin: '07/10 08:00:30',
    duracion: '29,6 s',
    filas: null,
    estado: 'interrumpida',
    notificacion: 'no enviada',
    intentos: 1,
    error: 'El proceso se reinició durante la ejecución.'
  }, {
    id: 'ej_9042',
    inicio: '06/10 08:00:01',
    fin: '06/10 08:00:09',
    duracion: '8,2 s',
    filas: null,
    estado: 'fallo',
    notificacion: 'no enviada',
    intentos: 3,
    error: 'No existe la relación "productos_stock". SQLSTATE 42P01'
  }, {
    id: 'ej_9041',
    inicio: '05/10 08:00:01',
    fin: '05/10 08:00:02',
    duracion: '1,2 s',
    filas: 0,
    estado: 'ok',
    notificacion: 'sin datos',
    intentos: 1,
    error: null
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/consola/datos-consola.js", error: String((e && e.message) || e) }); }

// ui_kits/datos-muestra.js
try { (() => {
/* DATOS DE MUESTRA — reemplazables sin tocar el diseño. Tienda de alimentos ficticia. */
window.DATOS_MUESTRA = {
  tenants: [{
    id: 'ten_7f3a',
    nombre: 'Almacén Don Tito',
    agente: 'conectado',
    latido: 'hace 12 s',
    frescura: '4 min'
  }, {
    id: 'ten_2c91',
    nombre: 'Panadería La Espiga',
    agente: 'desconectado',
    latido: 'hace 3 h',
    frescura: '3 h 10 min'
  }, {
    id: 'ten_b044',
    nombre: 'Dietética Raíces',
    agente: 'sin_datos',
    latido: null,
    frescura: '—'
  }],
  productos: [{
    sku: 'ALM-0012',
    nombre: 'Yerba mate 1 kg',
    deposito: 'Central',
    stock_actual: 8,
    stock_minimo: 20
  }, {
    sku: 'ALM-0047',
    nombre: 'Aceite de girasol 1,5 L',
    deposito: 'Central',
    stock_actual: 14,
    stock_minimo: 24
  }, {
    sku: 'ALM-0103',
    nombre: 'Harina 000 1 kg',
    deposito: 'Sucursal Norte',
    stock_actual: 3,
    stock_minimo: 30
  }, {
    sku: 'ALM-0150',
    nombre: 'Dulce de leche 400 g',
    deposito: 'Central',
    stock_actual: 11,
    stock_minimo: 12
  }, {
    sku: 'ALM-0188',
    nombre: 'Arroz largo fino 1 kg',
    deposito: 'Sucursal Norte',
    stock_actual: 19,
    stock_minimo: 25
  }, {
    sku: 'ALM-0201',
    nombre: 'Fideos tirabuzón 500 g',
    deposito: 'Central',
    stock_actual: 0,
    stock_minimo: 40
  }, {
    sku: 'ALM-0233',
    nombre: 'Tomate triturado 520 g',
    deposito: 'Central',
    stock_actual: 22,
    stock_minimo: 30
  }, {
    sku: 'ALM-0290',
    nombre: 'Galletitas de agua 3x',
    deposito: 'Sucursal Norte',
    stock_actual: null,
    stock_minimo: 18
  }],
  consultasGuardadas: [{
    id: 'q_31',
    nombre: 'Stock bajo por depósito',
    descripcion: 'Productos por debajo del mínimo, por depósito.',
    version: 4,
    editada: '02/10 18:40',
    autor: 'Lucía'
  }, {
    id: 'q_28',
    nombre: 'Ventas del día',
    descripcion: 'Pedidos confirmados de las últimas 24 h.',
    version: 2,
    editada: '28/09 10:05',
    autor: 'Martín'
  }, {
    id: 'q_19',
    nombre: 'Insumos para producción',
    descripcion: 'Insumos y rendimiento por receta.',
    version: 7,
    editada: '21/09 16:22',
    autor: 'Lucía'
  }],
  versiones: [{
    v: 4,
    fecha: '02/10 18:40',
    autor: 'Lucía',
    nota: 'Agrega filtro por depósito'
  }, {
    v: 3,
    fecha: '30/09 09:12',
    autor: 'Lucía',
    nota: 'Parámetro :umbral'
  }, {
    v: 2,
    fecha: '25/09 15:01',
    autor: 'Martín',
    nota: 'Ordena por stock'
  }, {
    v: 1,
    fecha: '24/09 11:30',
    autor: 'Martín',
    nota: 'Versión inicial'
  }],
  sqlEjemplo: 'SELECT p.sku, p.nombre, p.deposito,\n       p.stock_actual, p.stock_minimo\nFROM productos p\nWHERE p.stock_actual < :umbral\n  AND (:deposito IS NULL OR p.deposito = :deposito)\nORDER BY p.stock_actual ASC;',
  parametros: [{
    nombre: 'umbral',
    tipo: 'entero',
    valor: '25',
    requerido: true
  }, {
    nombre: 'deposito',
    tipo: 'texto',
    valor: '',
    requerido: false
  }],
  plantillas: [{
    id: 'stock_fisico',
    nombre: 'Alerta de stock físico',
    descripcion: 'Avisa cuando un producto queda por debajo del mínimo.',
    icon: 'package',
    meta: 'Tolerancia de frescura: 1 h',
    tolerancia: 60
  }, {
    id: 'stock_producible',
    nombre: 'Alerta de stock producible',
    descripcion: 'Avisa cuando los insumos no alcanzan para producir.',
    icon: 'boxes',
    meta: 'Tolerancia de frescura: 2 h',
    tolerancia: 120
  }, {
    id: 'reporte_diario',
    nombre: 'Reporte diario',
    descripcion: 'Resumen del día enviado por correo a la mañana.',
    icon: 'file-text',
    meta: 'Tolerancia de frescura: 24 h',
    tolerancia: 1440
  }],
  automatizaciones: [{
    id: 'au_11',
    plantilla: 'stock_fisico',
    nombre: 'Stock bajo — Central',
    consulta: 'Stock bajo por depósito',
    horario: 'Todos los días 08:00',
    destino: 'compras@dontito.com.ar',
    estado: 'activa',
    ultima: 'exitosa',
    ultimaHora: '03/10 08:00',
    proxima: '04/10 08:00'
  }, {
    id: 'au_12',
    plantilla: 'reporte_diario',
    nombre: 'Reporte diario de ventas',
    consulta: 'Ventas del día',
    horario: 'Lun a sáb 07:30',
    destino: 'tito@dontito.com.ar',
    estado: 'activa',
    ultima: 'reintentando',
    ultimaHora: '03/10 07:30',
    proxima: '04/10 07:30'
  }, {
    id: 'au_13',
    plantilla: 'stock_producible',
    nombre: 'Insumos de panificados',
    consulta: 'Insumos para producción',
    horario: 'Cada 2 h, 06:00–20:00',
    destino: 'produccion@dontito.com.ar',
    estado: 'pausada',
    ultima: 'fallida',
    ultimaHora: '01/10 14:00',
    proxima: '—'
  }],
  ejecuciones: [{
    id: 'ej_9046',
    automatizacion: 'Reporte diario de ventas',
    inicio: '03/10 07:30:00',
    fin: '—',
    duracion: '—',
    filas: null,
    estado: 'reintentando',
    intento: '2/3',
    error: 'Tiempo de espera agotado (30 s) al consultar la réplica.'
  }, {
    id: 'ej_9045',
    automatizacion: 'Stock bajo — Central',
    inicio: '03/10 08:00:02',
    fin: '03/10 08:00:04',
    duracion: '1,8 s',
    filas: 3,
    estado: 'exitosa'
  }, {
    id: 'ej_9044',
    automatizacion: 'Stock bajo — Central',
    inicio: '03/10 08:00:02',
    fin: '03/10 08:00:02',
    duracion: '0,1 s',
    filas: 3,
    estado: 'duplicado_evitado',
    error: 'El correo de esta ventana ya se había enviado (ej_9045). No se reenvió.'
  }, {
    id: 'ej_9043',
    automatizacion: 'Insumos de panificados',
    inicio: '02/10 14:00:00',
    fin: '—',
    duracion: '—',
    filas: null,
    estado: 'omitida',
    error: 'La ejecución anterior seguía en curso.'
  }, {
    id: 'ej_9042',
    automatizacion: 'Insumos de panificados',
    inicio: '02/10 12:00:00',
    fin: '02/10 12:00:30',
    duracion: '30,0 s',
    filas: null,
    estado: 'interrumpida',
    error: 'El proceso se reinició durante la ejecución.'
  }, {
    id: 'ej_9041',
    automatizacion: 'Insumos de panificados',
    inicio: '01/10 14:00:01',
    fin: '01/10 14:00:09',
    duracion: '8,2 s',
    filas: null,
    estado: 'fallida',
    error: 'relation "recetas_insumos" does not exist (42P01)'
  }, {
    id: 'ej_9040',
    automatizacion: 'Reporte diario de ventas',
    inicio: '02/10 07:30:00',
    fin: '02/10 07:30:03',
    duracion: '2,6 s',
    filas: 41,
    estado: 'exitosa'
  }, {
    id: 'ej_9039',
    automatizacion: 'Stock bajo — Central',
    inicio: '02/10 08:00:01',
    fin: '02/10 08:00:02',
    duracion: '1,2 s',
    filas: 0,
    estado: 'sin_datos'
  }],
  agentes: [{
    id: 'ag_01',
    tenant: 'Almacén Don Tito',
    nombre: 'Servidor local tienda',
    token: 'zd_ag_••••8f2c',
    alta: '12/09',
    estado: 'conectado',
    latido: 'hace 12 s'
  }, {
    id: 'ag_02',
    tenant: 'Panadería La Espiga',
    nombre: 'PC administración',
    token: 'zd_ag_••••a17e',
    alta: '20/09',
    estado: 'desconectado',
    latido: 'hace 3 h'
  }, {
    id: 'ag_03',
    tenant: 'Dietética Raíces',
    nombre: 'Sin instalar',
    token: 'zd_ag_••••03bd',
    alta: '02/10',
    estado: 'sin_datos',
    latido: null
  }],
  enRiesgo: [{
    tenant: 'Panadería La Espiga',
    automatizacion: 'Stock de harinas',
    proxima: '03/10 16:00'
  }, {
    tenant: 'Panadería La Espiga',
    automatizacion: 'Reporte diario',
    proxima: '04/10 07:00'
  }],
  mapeo: [{
    entidad: 'producto',
    campo: 'sku',
    tipo: 'texto',
    origen: 'productos.codigo',
    estado: 'ok'
  }, {
    entidad: 'producto',
    campo: 'nombre',
    tipo: 'texto',
    origen: 'productos.descripcion',
    estado: 'ok'
  }, {
    entidad: 'producto',
    campo: 'stock_actual',
    tipo: 'entero',
    origen: 'stock.cantidad',
    estado: 'ok'
  }, {
    entidad: 'producto',
    campo: 'stock_minimo',
    tipo: 'entero',
    origen: null,
    estado: 'falta'
  }, {
    entidad: 'receta',
    campo: 'insumo_id',
    tipo: 'entero',
    origen: null,
    estado: 'inaplicable',
    motivo: 'La tienda no fabrica productos propios.'
  }],
  /* PANEL — tenant deducido de la sesión */
  sesion: {
    usuario: 'Héctor (Tito) Gómez',
    correo: 'tito@dontito.com.ar',
    negocio: 'Almacén Don Tito'
  },
  panel: [{
    id: 'au_11',
    titulo: 'Aviso de stock bajo',
    descripcion: 'Te avisamos por correo cuando un producto queda por debajo del mínimo que elijas.',
    estado: 'activa',
    ultima: 'Hoy 08:00 · 3 productos con poco stock',
    proxima: 'Mañana 08:00',
    frecuencia: 'Todos los días',
    umbral: 20,
    hora: '08:00',
    dias: 'todos',
    correo: 'compras@dontito.com.ar'
  }, {
    id: 'au_12',
    titulo: 'Resumen diario de ventas',
    descripcion: 'Cada mañana te llega un resumen de lo vendido el día anterior.',
    estado: 'con_falla',
    ultima: 'Hoy 07:30 · No se pudo enviar',
    proxima: 'Volvemos a intentar 09:30',
    frecuencia: 'Lunes a sábado',
    falla: {
      titulo: 'No pudimos armar tu resumen de esta mañana',
      cuerpo: 'Tu tienda tardó demasiado en responder. Lo intentamos de nuevo a las 09:30; no tenés que hacer nada. Si vuelve a pasar, te avisamos.'
    },
    hora: '07:30',
    dias: 'lun-sab',
    correo: 'tito@dontito.com.ar'
  }, {
    id: 'disp_1',
    titulo: 'Aviso de insumos para producir',
    descripcion: 'Te avisamos cuando lo que tenés no alcanza para fabricar tus productos.',
    disponible: true,
    tolerancia: '2 h'
  }],
  frescuraPanel: {
    ultimaActualizacion: 'hace 3 h 10 min',
    tolerancia: '2 h'
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/datos-muestra.js", error: String((e && e.message) || e) }); }

// ui_kits/panel/PanelShell.jsx
try { (() => {
(() => {
  const {
    Icon,
    Button,
    Field,
    Banner
  } = window.ZeroDashboardDesignSystem_589ca0;
  const panelStyles = {
    header: {
      position: 'sticky',
      top: 0,
      zIndex: 20,
      background: 'var(--surface-card)',
      borderBottom: '1px solid var(--border-1)'
    },
    headerIn: {
      maxWidth: 'var(--panel-max)',
      margin: '0 auto',
      padding: '0 var(--space-6)',
      minHeight: 60,
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-5)'
    },
    main: {
      maxWidth: 'var(--panel-max)',
      margin: '0 auto',
      padding: 'var(--space-9) var(--space-6) var(--space-12)',
      display: 'grid',
      gap: 'var(--gap-section)'
    }
  };
  function PanelShell({
    sesion,
    onSalir,
    children
  }) {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("header", {
      style: panelStyles.header
    }, /*#__PURE__*/React.createElement("div", {
      style: panelStyles.headerIn
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        fontSize: 'var(--text-lg)',
        letterSpacing: '-.02em'
      }
    }, "ZeroDashboard"), /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        width: 1,
        height: 20,
        background: 'var(--border-2)'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        fontWeight: 600,
        color: 'var(--text-2)',
        fontSize: 'var(--text-sm)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "store"
    }), sesion.negocio), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      icon: "log-out",
      onClick: onSalir
    }, "Salir"))), /*#__PURE__*/React.createElement("main", {
      style: panelStyles.main
    }, children));
  }
  function BackLink({
    onClick,
    children
  }) {
    return /*#__PURE__*/React.createElement("button", {
      onClick: onClick,
      className: "zd-btn zd-btn--ghost",
      style: {
        justifySelf: 'start',
        paddingLeft: 0
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-left"
    }), children);
  }
  function ScreenIngreso({
    onIngresar
  }) {
    const [err, setErr] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const submit = e => {
      e.preventDefault();
      const v = e.target.elements.correo.value;
      if (!v.includes('@')) {
        setErr(true);
        return;
      }
      setErr(false);
      setLoading(true);
      setTimeout(onIngresar, 600);
    };
    return /*#__PURE__*/React.createElement("section", {
      "data-screen-label": "Ingreso",
      "data-change": "CH-22",
      "data-estado": "pendiente",
      style: {
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-6)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 'min(420px, 100%)',
        display: 'grid',
        gap: 'var(--space-8)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 'var(--space-3)',
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        fontSize: 'var(--text-2xl)',
        letterSpacing: '-.02em'
      }
    }, "ZeroDashboard"), /*#__PURE__*/React.createElement("p", {
      className: "zd-muted",
      style: {
        margin: 0
      }
    }, "Tus avisos y reportes autom\xE1ticos, en un solo lugar.")), /*#__PURE__*/React.createElement("form", {
      className: "zd-card zd-form",
      onSubmit: submit,
      noValidate: true
    }, /*#__PURE__*/React.createElement("h1", {
      className: "zd-h2"
    }, "Ingresar"), /*#__PURE__*/React.createElement(Field, {
      label: "Correo",
      name: "correo",
      type: "email",
      autoComplete: "email",
      defaultValue: "tito@dontito.com.ar",
      error: err ? 'Escribí un correo válido, por ejemplo nombre@tutienda.com.ar.' : null
    }), /*#__PURE__*/React.createElement(Field, {
      label: "Contrase\xF1a",
      name: "clave",
      type: "password",
      autoComplete: "current-password",
      defaultValue: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
    }), /*#__PURE__*/React.createElement(Button, {
      type: "submit",
      variant: "primary",
      block: true,
      loading: loading
    }, "Ingresar"), /*#__PURE__*/React.createElement("a", {
      href: "#",
      className: "zd-link",
      style: {
        fontSize: 'var(--text-sm)',
        justifySelf: 'center'
      }
    }, "Olvid\xE9 mi contrase\xF1a")), /*#__PURE__*/React.createElement("p", {
      className: "zd-meta",
      style: {
        textAlign: 'center',
        margin: 0
      }
    }, "Entr\xE1s directo a tu negocio; no hace falta elegirlo.")));
  }
  Object.assign(window, {
    PanelShell,
    ScreenIngreso,
    BackLink
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/panel/PanelShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/panel/Screens.jsx
try { (() => {
(() => {
  const {
    Icon,
    Button,
    Field,
    Banner,
    AutomationCard,
    StatusBadge,
    DataTable
  } = window.ZeroDashboardDesignSystem_589ca0;
  const D = window.DATOS_MUESTRA;
  function ActivarFrescura({
    auto,
    onClose,
    onActivar
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(12,15,18,.45)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 100,
        padding: 'var(--space-6)'
      },
      onClick: onClose
    }, /*#__PURE__*/React.createElement("div", {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "frescura-t",
      className: "zd-card",
      "data-change": "CH-26",
      "data-estado": "pendiente",
      style: {
        width: 'min(520px,100%)',
        boxShadow: 'var(--shadow-3)',
        display: 'grid',
        gap: 'var(--space-6)'
      },
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("h2", {
      className: "zd-h2",
      id: "frescura-t"
    }, "Antes de activar \xAB", auto.titulo, "\xBB"), /*#__PURE__*/React.createElement(Banner, {
      tone: "warn",
      title: "Los datos de tu tienda llegan con atraso"
    }, "Hoy la informaci\xF3n se actualiz\xF3 ", D.frescuraPanel.ultimaActualizacion, ". Este aviso necesita datos de hace menos de ", auto.tolerancia, " para ser confiable, as\xED que podr\xEDa avisarte tarde."), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0
      }
    }, "Pod\xE9s activarlo igual. Si la actualizaci\xF3n mejora, el aviso empieza a funcionar a tiempo sin que hagas nada."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 'var(--space-4)',
        justifyContent: 'flex-end',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      onClick: onClose
    }, "Ahora no"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: onActivar
    }, "Activar de todos modos"))));
  }
  function ScreenMisAutomatizaciones({
    onAjustar,
    onResultado
  }) {
    const [items, setItems] = React.useState(D.panel);
    const [activando, setActivando] = React.useState(null);
    const [ok, setOk] = React.useState(null);
    const activas = items.filter(a => !a.disponible);
    const disponibles = items.filter(a => a.disponible);
    const activar = a => {
      setItems(xs => xs.map(x => x.id === a.id ? Object.assign({}, x, {
        disponible: false,
        estado: 'activa',
        ultima: 'Todavía no se ejecutó',
        proxima: 'Mañana 08:00',
        frecuencia: 'Todos los días'
      }) : x));
      setActivando(null);
      setOk(a.titulo);
    };
    return /*#__PURE__*/React.createElement("section", {
      "data-screen-label": "Mis automatizaciones",
      "data-change": "CH-22",
      "data-estado": "pendiente",
      style: {
        display: 'grid',
        gap: 'var(--gap-section)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 'var(--space-3)'
      }
    }, /*#__PURE__*/React.createElement("h1", {
      className: "zd-h1"
    }, "Mis automatizaciones"), /*#__PURE__*/React.createElement("p", {
      className: "zd-muted",
      style: {
        margin: 0
      }
    }, "Lo que revisamos por vos y te mandamos por correo.")), ok ? /*#__PURE__*/React.createElement(Banner, {
      tone: "ok",
      title: 'Activaste «' + ok + '»',
      onDismiss: () => setOk(null)
    }, "La primera revisi\xF3n es ma\xF1ana a las 08:00.") : null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 'var(--space-6)'
      }
    }, /*#__PURE__*/React.createElement("h2", {
      className: "zd-h2"
    }, "Activas"), activas.map(a => /*#__PURE__*/React.createElement(AutomationCard, {
      key: a.id,
      titulo: a.titulo,
      descripcion: a.descripcion,
      estado: a.estado,
      ultima: a.ultima,
      proxima: a.proxima,
      frecuencia: a.frecuencia,
      alert: a.falla ? /*#__PURE__*/React.createElement("div", {
        "data-change": "CH-22",
        "data-estado": "pendiente"
      }, /*#__PURE__*/React.createElement(Banner, {
        inline: true,
        tone: "error",
        title: a.falla.titulo
      }, a.falla.cuerpo)) : null
    }, /*#__PURE__*/React.createElement(Button, {
      icon: "sliders-horizontal",
      onClick: () => onAjustar(a)
    }, "Ajustar"), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      icon: "table",
      onClick: () => onResultado(a)
    }, "Ver \xFAltimo resultado")))), disponibles.length ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 'var(--space-6)'
      }
    }, /*#__PURE__*/React.createElement("h2", {
      className: "zd-h2"
    }, "Disponibles para activar"), disponibles.map(a => /*#__PURE__*/React.createElement(AutomationCard, {
      key: a.id,
      disponible: true,
      titulo: a.titulo,
      descripcion: a.descripcion
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      icon: "plus",
      onClick: () => setActivando(a)
    }, "Activar")))) : null, activando ? /*#__PURE__*/React.createElement(ActivarFrescura, {
      auto: activando,
      onClose: () => setActivando(null),
      onActivar: () => activar(activando)
    }) : null);
  }
  function ScreenAjustes({
    auto,
    onVolver
  }) {
    const [saved, setSaved] = React.useState(false);
    const [err, setErr] = React.useState(null);
    const guardar = e => {
      e.preventDefault();
      const u = Number(e.target.elements.umbral ? e.target.elements.umbral.value : 1);
      if (u < 1) {
        setErr('El mínimo tiene que ser 1 o más.');
        setSaved(false);
        return;
      }
      setErr(null);
      setSaved(true);
    };
    const esStock = auto.id === 'au_11';
    return /*#__PURE__*/React.createElement("section", {
      "data-screen-label": "Ajustes",
      "data-change": "CH-23",
      "data-estado": "pendiente",
      style: {
        display: 'grid',
        gap: 'var(--gap-section)',
        maxWidth: 640
      }
    }, /*#__PURE__*/React.createElement(BackLink, {
      onClick: onVolver
    }, "Mis automatizaciones"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 'var(--space-3)'
      }
    }, /*#__PURE__*/React.createElement("h1", {
      className: "zd-h1"
    }, "Ajustar \xAB", auto.titulo, "\xBB"), /*#__PURE__*/React.createElement("p", {
      className: "zd-muted",
      style: {
        margin: 0
      }
    }, "Los cambios rigen desde la pr\xF3xima revisi\xF3n.")), saved ? /*#__PURE__*/React.createElement(Banner, {
      tone: "ok",
      title: "Guardamos tus cambios",
      onDismiss: () => setSaved(false)
    }, "Se aplican desde la pr\xF3xima revisi\xF3n: ", auto.proxima.toLowerCase(), ".") : null, /*#__PURE__*/React.createElement("form", {
      className: "zd-card zd-form",
      onSubmit: guardar,
      noValidate: true
    }, esStock ? /*#__PURE__*/React.createElement(Field, {
      label: "Avisarme cuando un producto tenga menos de",
      name: "umbral",
      type: "number",
      min: 1,
      defaultValue: auto.umbral,
      suffix: "unidades",
      help: "Vale para todos tus productos.",
      error: err
    }) : null, /*#__PURE__*/React.createElement("div", {
      className: "zd-form-row"
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Hora de env\xEDo",
      as: "select",
      defaultValue: auto.hora
    }, /*#__PURE__*/React.createElement("option", null, "07:00"), /*#__PURE__*/React.createElement("option", null, "07:30"), /*#__PURE__*/React.createElement("option", null, "08:00"), /*#__PURE__*/React.createElement("option", null, "09:00"), /*#__PURE__*/React.createElement("option", null, "12:00"), /*#__PURE__*/React.createElement("option", null, "18:00")), /*#__PURE__*/React.createElement(Field, {
      label: "D\xEDas",
      as: "select",
      defaultValue: auto.dias
    }, /*#__PURE__*/React.createElement("option", {
      value: "todos"
    }, "Todos los d\xEDas"), /*#__PURE__*/React.createElement("option", {
      value: "lun-sab"
    }, "Lunes a s\xE1bado"), /*#__PURE__*/React.createElement("option", {
      value: "lun-vie"
    }, "Lunes a viernes"))), /*#__PURE__*/React.createElement(Field, {
      label: "Enviar a",
      type: "email",
      defaultValue: auto.correo,
      help: "Pod\xE9s poner varios correos separados por coma."
    }), /*#__PURE__*/React.createElement("div", {
      className: "zd-form-actions"
    }, /*#__PURE__*/React.createElement(Button, {
      type: "submit",
      variant: "primary",
      icon: "check"
    }, "Guardar cambios"), /*#__PURE__*/React.createElement(Button, {
      onClick: onVolver
    }, "Cancelar"))));
  }
  function Barras({
    rows
  }) {
    const max = Math.max.apply(null, rows.map(r => r.stock_minimo));
    return /*#__PURE__*/React.createElement("figure", {
      style: {
        margin: 0,
        display: 'grid',
        gap: 'var(--space-5)'
      },
      "aria-label": "Stock actual comparado con el m\xEDnimo"
    }, rows.map(r => /*#__PURE__*/React.createElement("div", {
      key: r.sku,
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(120px,200px) 1fr auto',
        gap: 'var(--space-5)',
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--text-sm)'
      }
    }, r.nombre), /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'relative',
        height: 14,
        background: 'var(--surface-sunken)',
        borderRadius: 'var(--radius-sm)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        inset: '0 auto 0 0',
        width: (r.stock_actual || 0) / max * 100 + '%',
        background: 'var(--warn)',
        borderRadius: 'var(--radius-sm)'
      }
    }), /*#__PURE__*/React.createElement("span", {
      title: "M\xEDnimo",
      style: {
        position: 'absolute',
        top: -3,
        bottom: -3,
        left: r.stock_minimo / max * 100 + '%',
        width: 2,
        background: 'var(--text-1)'
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: "zd-num",
      style: {
        fontSize: 'var(--text-sm)',
        minWidth: 70,
        textAlign: 'right'
      }
    }, r.stock_actual ?? '—', " / ", r.stock_minimo))), /*#__PURE__*/React.createElement("figcaption", {
      className: "zd-meta",
      style: {
        display: 'flex',
        gap: 'var(--space-6)'
      }
    }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-block',
        width: 10,
        height: 10,
        background: 'var(--warn)',
        borderRadius: 2,
        marginRight: 6
      }
    }), "Stock actual"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-block',
        width: 2,
        height: 10,
        background: 'var(--text-1)',
        marginRight: 6
      }
    }), "M\xEDnimo")));
  }
  function ScreenResultado({
    auto,
    onVolver
  }) {
    const [vista, setVista] = React.useState('tabla');
    const rows = D.productos.filter(p => p.stock_actual !== null && p.stock_actual < 20).slice(0, 5);
    const cols = [{
      key: 'nombre',
      label: 'Producto'
    }, {
      key: 'deposito',
      label: 'Dónde'
    }, {
      key: 'stock_actual',
      label: 'Quedan',
      align: 'num'
    }, {
      key: 'stock_minimo',
      label: 'Mínimo',
      align: 'num'
    }];
    return /*#__PURE__*/React.createElement("section", {
      "data-screen-label": "\xDAltimo resultado",
      "data-change": "CH-27",
      "data-estado": "pendiente",
      style: {
        display: 'grid',
        gap: 'var(--gap-section)'
      }
    }, /*#__PURE__*/React.createElement(BackLink, {
      onClick: onVolver
    }, "Mis automatizaciones"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 'var(--space-6)',
        alignItems: 'flex-end',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 240,
        display: 'grid',
        gap: 'var(--space-3)'
      }
    }, /*#__PURE__*/React.createElement("h1", {
      className: "zd-h1"
    }, "\xDAltimo resultado"), /*#__PURE__*/React.createElement("p", {
      className: "zd-muted",
      style: {
        margin: 0
      }
    }, auto.titulo, " \xB7 hoy 08:00 \xB7 ", rows.length, " productos con poco stock")), /*#__PURE__*/React.createElement("div", {
      role: "group",
      "aria-label": "Vista",
      style: {
        display: 'flex',
        gap: 'var(--space-2)',
        padding: 'var(--space-1)',
        background: 'var(--surface-sunken)',
        borderRadius: 'var(--radius-md)'
      }
    }, [['tabla', 'Tabla', 'table'], ['grafico', 'Gráfico', 'chart-column']].map(([k, l, i]) => /*#__PURE__*/React.createElement(Button, {
      key: k,
      variant: vista === k ? 'secondary' : 'ghost',
      icon: i,
      "aria-pressed": vista === k,
      onClick: () => setVista(k)
    }, l)))), vista === 'tabla' ? /*#__PURE__*/React.createElement(DataTable, {
      caption: "Productos con poco stock",
      columns: cols,
      rows: rows,
      nullLabel: "\u2014"
    }) : /*#__PURE__*/React.createElement("div", {
      className: "zd-card"
    }, /*#__PURE__*/React.createElement(Barras, {
      rows: rows
    })));
  }
  Object.assign(window, {
    ScreenMisAutomatizaciones,
    ScreenAjustes,
    ScreenResultado
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/panel/Screens.jsx", error: String((e && e.message) || e) }); }

__ds_ns.AutomationCard = __ds_scope.AutomationCard;

__ds_ns.Stepper = __ds_scope.Stepper;

__ds_ns.TemplatePicker = __ds_scope.TemplatePicker;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.ICONS = __ds_scope.ICONS;

__ds_ns.DataTable = __ds_scope.DataTable;

__ds_ns.ESTADOS = __ds_scope.ESTADOS;

__ds_ns.StatusBadge = __ds_scope.StatusBadge;

__ds_ns.Banner = __ds_scope.Banner;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.ErrorState = __ds_scope.ErrorState;

__ds_ns.LoadingState = __ds_scope.LoadingState;

__ds_ns.Field = __ds_scope.Field;

__ds_ns.KeyValueList = __ds_scope.KeyValueList;

__ds_ns.PageHeader = __ds_scope.PageHeader;

__ds_ns.ScopeTag = __ds_scope.ScopeTag;

__ds_ns.SideNav = __ds_scope.SideNav;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Drawer = __ds_scope.Drawer;

__ds_ns.ConnectivityIndicator = __ds_scope.ConnectivityIndicator;

__ds_ns.TenantBar = __ds_scope.TenantBar;

})();

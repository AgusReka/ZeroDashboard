/* @ds-bundle: {"format":4,"namespace":"ZeroDashboardDesignSystem_589ca0","components":[{"name":"AutomationCard","sourcePath":"components/automation/AutomationCard.jsx"},{"name":"Stepper","sourcePath":"components/automation/Stepper.jsx"},{"name":"TemplatePicker","sourcePath":"components/automation/TemplatePicker.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"ICONS","sourcePath":"components/core/iconData.js"},{"name":"DataTable","sourcePath":"components/data/DataTable.jsx"},{"name":"ESTADOS","sourcePath":"components/data/StatusBadge.jsx"},{"name":"StatusBadge","sourcePath":"components/data/StatusBadge.jsx"},{"name":"Banner","sourcePath":"components/feedback/Banner.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"ErrorState","sourcePath":"components/feedback/ErrorState.jsx"},{"name":"LoadingState","sourcePath":"components/feedback/LoadingState.jsx"},{"name":"Field","sourcePath":"components/forms/Field.jsx"},{"name":"ConnectivityIndicator","sourcePath":"components/tenant/ConnectivityIndicator.jsx"},{"name":"TenantBar","sourcePath":"components/tenant/TenantBar.jsx"}],"sourceHashes":{"components/automation/AutomationCard.jsx":"5480ace57566","components/automation/Stepper.jsx":"ee2dd20fc631","components/automation/TemplatePicker.jsx":"9c63cd084241","components/core/Button.jsx":"7dca0f1844b0","components/core/Icon.jsx":"a6f6221496df","components/core/iconData.js":"a62e633c7dc1","components/data/DataTable.jsx":"1640bb37019d","components/data/StatusBadge.jsx":"e5c37f175325","components/feedback/Banner.jsx":"bb4f85d3f7fe","components/feedback/EmptyState.jsx":"6ab18843fdf1","components/feedback/ErrorState.jsx":"203f811e0850","components/feedback/LoadingState.jsx":"bf0e8dbaf2ef","components/forms/Field.jsx":"5d0bff9ad5ba","components/tenant/ConnectivityIndicator.jsx":"a0ad168b5dd7","components/tenant/TenantBar.jsx":"4e40b2365d08","ui_kits/consola/ConsolaShell.jsx":"3083d3db7349","ui_kits/consola/ScreenAutomatizaciones.jsx":"1490023a4796","ui_kits/consola/ScreenConsultas.jsx":"5086fbbba55c","ui_kits/consola/ScreenEjecuciones.jsx":"3e054c6d3826","ui_kits/consola/ScreenOperacion.jsx":"0c4ef3024fe5","ui_kits/datos-muestra.js":"c36639187b52","ui_kits/panel/PanelShell.jsx":"68655f1f898c","ui_kits/panel/Screens.jsx":"425831f80a29"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ZeroDashboardDesignSystem_589ca0 = window.ZeroDashboardDesignSystem_589ca0 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

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
  "menu": "<line x1=\"4\" x2=\"20\" y1=\"12\" y2=\"12\" /><line x1=\"4\" x2=\"20\" y1=\"6\" y2=\"6\" /><line x1=\"4\" x2=\"20\" y1=\"18\" y2=\"18\" />"
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

// ui_kits/consola/ConsolaShell.jsx
try { (() => {
(() => {
  const {
    Icon,
    Button,
    TenantBar,
    ConnectivityIndicator
  } = window.ZeroDashboardDesignSystem_589ca0;
  const NAV = [{
    group: 'Datos',
    items: [{
      id: 'conexion',
      label: 'Conexión y mapeo',
      icon: 'plug'
    }, {
      id: 'contrato',
      label: 'Contrato canónico',
      icon: 'layers'
    }, {
      id: 'consultas',
      label: 'Consultas',
      icon: 'database'
    }]
  }, {
    group: 'Automatización',
    items: [{
      id: 'automatizaciones',
      label: 'Automatizaciones',
      icon: 'calendar-clock'
    }, {
      id: 'ejecuciones',
      label: 'Ejecuciones',
      icon: 'activity'
    }]
  }, {
    group: 'Operación',
    items: [{
      id: 'agentes',
      label: 'Agentes y conectividad',
      icon: 'server'
    }, {
      id: 'frescura',
      label: 'Frescura',
      icon: 'timer'
    }, {
      id: 'auditoria',
      label: 'Auditoría',
      icon: 'scroll-text'
    }, {
      id: 'alta',
      label: 'Tiempos de alta',
      icon: 'gauge'
    }]
  }];
  const shellStyles = {
    grid: {
      display: 'grid',
      gridTemplateColumns: 'var(--sidebar-w) minmax(0,1fr)',
      minHeight: 'calc(100vh - var(--tenantbar-h))'
    },
    side: {
      borderRight: '1px solid var(--border-1)',
      background: 'var(--surface-card)',
      padding: 'var(--space-6) var(--space-4)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)',
      position: 'sticky',
      top: 'var(--tenantbar-h)',
      height: 'calc(100vh - var(--tenantbar-h))',
      overflow: 'auto'
    },
    brand: {
      display: 'grid',
      padding: '0 var(--space-4)'
    },
    navItem: on => ({
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      width: '100%',
      height: 32,
      padding: '0 var(--space-4)',
      border: 0,
      borderRadius: 'var(--radius-md)',
      background: on ? 'var(--surface-selected)' : 'transparent',
      color: on ? 'var(--accent-text)' : 'var(--text-2)',
      font: 'inherit',
      fontSize: 'var(--text-sm)',
      fontWeight: on ? 600 : 500,
      cursor: 'pointer',
      textAlign: 'left'
    }),
    main: {
      padding: 'var(--space-8) var(--space-9)',
      maxWidth: 'var(--content-max)',
      width: '100%',
      display: 'grid',
      gap: 'var(--space-8)',
      alignContent: 'start'
    },
    overlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(12,15,18,.45)',
      display: 'grid',
      placeItems: 'center',
      zIndex: 100
    }
  };
  function Sidebar({
    current,
    onNav,
    theme,
    onTheme
  }) {
    return /*#__PURE__*/React.createElement("nav", {
      style: shellStyles.side,
      "aria-label": "Secciones de la consola"
    }, /*#__PURE__*/React.createElement("div", {
      style: shellStyles.brand
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        fontSize: 'var(--text-md)',
        letterSpacing: '-.02em'
      }
    }, "ZeroDashboard"), /*#__PURE__*/React.createElement("span", {
      className: "zd-eyebrow"
    }, "Consola \xB7 Implementador")), NAV.map(g => /*#__PURE__*/React.createElement("div", {
      key: g.group,
      style: {
        display: 'grid',
        gap: 2
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "zd-eyebrow",
      style: {
        padding: '0 var(--space-4) var(--space-3)'
      }
    }, g.group), g.items.map(it => /*#__PURE__*/React.createElement("button", {
      key: it.id,
      style: shellStyles.navItem(current === it.id),
      "aria-current": current === it.id ? 'page' : undefined,
      onClick: () => onNav(it.id)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: it.icon
    }), it.label)))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: '0 var(--space-4)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "user"
    }), /*#__PURE__*/React.createElement("span", {
      className: "zd-meta",
      style: {
        flex: 1
      }
    }, "lucia@zerodashboard"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost",
      iconOnly: true,
      icon: theme === 'dark' ? 'sun' : 'moon',
      label: "Cambiar modo claro/oscuro",
      onClick: onTheme
    })));
  }
  function PageHeader({
    eyebrow,
    title,
    desc,
    actions,
    change,
    estado
  }) {
    return /*#__PURE__*/React.createElement("header", {
      style: {
        display: 'flex',
        gap: 'var(--space-6)',
        alignItems: 'flex-end',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 260,
        display: 'grid',
        gap: 'var(--space-2)'
      }
    }, eyebrow ? /*#__PURE__*/React.createElement("span", {
      className: "zd-eyebrow"
    }, eyebrow) : null, /*#__PURE__*/React.createElement("h1", {
      className: "zd-h1"
    }, title), desc ? /*#__PURE__*/React.createElement("p", {
      className: "zd-muted",
      style: {
        margin: 0,
        fontSize: 'var(--text-sm)'
      }
    }, desc) : null), change ? /*#__PURE__*/React.createElement("span", {
      className: "zd-tag",
      title: "Change y estado de dise\xF1o"
    }, change, " \xB7 ", estado) : null, actions ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 'var(--space-4)'
      }
    }, actions) : null);
  }
  function Modal({
    title,
    children,
    actions,
    onClose
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: shellStyles.overlay,
      onClick: onClose
    }, /*#__PURE__*/React.createElement("div", {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": title,
      className: "zd-card",
      style: {
        width: 'min(480px, 92vw)',
        boxShadow: 'var(--shadow-3)',
        display: 'grid',
        gap: 'var(--space-6)'
      },
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("h2", {
      className: "zd-h2"
    }, title), children, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 'var(--space-4)',
        justifyContent: 'flex-end'
      }
    }, actions)));
  }
  function TenantSwitcher({
    tenants,
    current,
    onPick,
    onClose
  }) {
    const [sel, setSel] = React.useState(current.id);
    const t = tenants.find(x => x.id === sel);
    return /*#__PURE__*/React.createElement(Modal, {
      title: "Cambiar tenant activo",
      onClose: onClose,
      actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
        onClick: onClose
      }, "Cancelar"), /*#__PURE__*/React.createElement(Button, {
        variant: "primary",
        disabled: sel === current.id,
        onClick: () => onPick(t)
      }, "Operar sobre ", t.nombre))
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 'var(--space-3)'
      },
      role: "radiogroup",
      "aria-label": "Tenants"
    }, tenants.map(x => /*#__PURE__*/React.createElement("label", {
      key: x.id,
      className: "zd-template",
      style: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 'var(--space-5)',
        gap: 'var(--space-5)'
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "radio",
      name: "tenant",
      checked: sel === x.id,
      onChange: () => setSel(x.id)
    }), /*#__PURE__*/React.createElement(Icon, {
      name: "building-2"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "zd-template__name"
    }, x.nombre), " ", /*#__PURE__*/React.createElement("span", {
      className: "zd-tag"
    }, x.id)), /*#__PURE__*/React.createElement(ConnectivityIndicator, {
      estado: x.agente
    })))), /*#__PURE__*/React.createElement("p", {
      className: "zd-meta",
      style: {
        margin: 0
      }
    }, "Todo lo que hagas despu\xE9s del cambio se aplica al tenant elegido. La barra violeta muestra siempre cu\xE1l es."));
  }
  function ConsolaShell({
    tenant,
    tenants,
    onTenant,
    current,
    onNav,
    children
  }) {
    const [switching, setSwitching] = React.useState(false);
    const [theme, setTheme] = React.useState(document.documentElement.dataset.theme || 'light');
    const toggle = () => {
      const n = theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = n;
      setTheme(n);
    };
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(TenantBar, {
      tenant: tenant,
      onChange: () => setSwitching(true)
    }, /*#__PURE__*/React.createElement(ConnectivityIndicator, {
      estado: tenant.agente,
      ultimoLatido: tenant.latido,
      onDark: true
    })), /*#__PURE__*/React.createElement("div", {
      style: shellStyles.grid
    }, /*#__PURE__*/React.createElement(Sidebar, {
      current: current,
      onNav: onNav,
      theme: theme,
      onTheme: toggle
    }), /*#__PURE__*/React.createElement("main", {
      style: shellStyles.main
    }, children)), switching ? /*#__PURE__*/React.createElement(TenantSwitcher, {
      tenants: tenants,
      current: tenant,
      onClose: () => setSwitching(false),
      onPick: t => {
        onTenant(t);
        setSwitching(false);
      }
    }) : null);
  }
  Object.assign(window, {
    ConsolaShell,
    PageHeader,
    Modal,
    NAV
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/consola/ConsolaShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/consola/ScreenAutomatizaciones.jsx
try { (() => {
(() => {
  const {
    Icon,
    Button,
    Field,
    DataTable,
    Banner,
    StatusBadge,
    TemplatePicker,
    Stepper
  } = window.ZeroDashboardDesignSystem_589ca0;
  const D = window.DATOS_MUESTRA;
  const plantillaNombre = id => (D.plantillas.find(p => p.id === id) || {}).nombre;
  function CorreoPreview({
    plantilla
  }) {
    return /*#__PURE__*/React.createElement("div", {
      "data-change": "CH-21",
      "data-estado": "pendiente",
      style: {
        display: 'grid',
        gap: 'var(--space-4)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "zd-label"
    }, "Formato del correo (N3)"), /*#__PURE__*/React.createElement("div", {
      style: {
        border: '1px solid var(--border-1)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: '#fff',
        color: '#13171b'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '10px 14px',
        borderBottom: '1px solid #e4e8eb',
        fontSize: 12,
        color: '#4a535c',
        display: 'grid',
        gap: 2
      }
    }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "Asunto:"), " ", plantilla === 'reporte_diario' ? 'Resumen del 03/10 — Almacén Don Tito' : '3 productos con poco stock — Almacén Don Tito'), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "Para:"), " compras@dontito.com.ar")), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 14,
        display: 'grid',
        gap: 8,
        fontSize: 13
      }
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        fontSize: 15
      }
    }, plantilla === 'reporte_diario' ? 'Así te fue ayer' : 'Estos productos están por debajo del mínimo'), /*#__PURE__*/React.createElement("table", {
      style: {
        borderCollapse: 'collapse',
        fontSize: 12,
        width: '100%'
      }
    }, /*#__PURE__*/React.createElement("tbody", null, D.productos.slice(0, 3).map(p => /*#__PURE__*/React.createElement("tr", {
      key: p.sku
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '4px 0',
        borderBottom: '1px solid #e4e8eb'
      }
    }, p.nombre), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '4px 0',
        borderBottom: '1px solid #e4e8eb',
        textAlign: 'right'
      }
    }, p.stock_actual, " / m\xEDn. ", p.stock_minimo))))), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: '#5f6973'
      }
    }, "Versi\xF3n completa en ui_kits/correo."))));
  }
  function Alta({
    onDone,
    onCancel
  }) {
    const [step, setStep] = React.useState(0);
    const [tpl, setTpl] = React.useState('stock_fisico');
    return /*#__PURE__*/React.createElement("section", {
      "data-screen-label": "Alta de automatizaci\xF3n",
      "data-change": "CH-21",
      "data-estado": "pendiente",
      style: {
        display: 'grid',
        gap: 'var(--space-8)'
      }
    }, /*#__PURE__*/React.createElement(PageHeader, {
      eyebrow: "Automatizaciones",
      title: "Nueva automatizaci\xF3n",
      desc: "Patr\xF3n fijo: consulta \u2192 condici\xF3n \u2192 notificaci\xF3n \u2192 registro.",
      change: "CH-21",
      estado: "PENDIENTE",
      actions: /*#__PURE__*/React.createElement(Button, {
        variant: "ghost",
        icon: "x",
        onClick: onCancel
      }, "Cancelar")
    }), /*#__PURE__*/React.createElement(Stepper, {
      steps: ['Elegir plantilla', 'Completar parámetros'],
      current: step
    }), step === 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 'var(--space-6)'
      }
    }, /*#__PURE__*/React.createElement(TemplatePicker, {
      value: tpl,
      onChange: setTpl,
      options: D.plantillas,
      legend: "Cat\xE1logo de plantillas"
    }), /*#__PURE__*/React.createElement("div", {
      className: "zd-form-actions"
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      iconRight: "arrow-right",
      onClick: () => setStep(1)
    }, "Continuar"))) : /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) 340px',
        gap: 'var(--space-8)',
        alignItems: 'start'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "zd-card zd-form"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)'
      }
    }, /*#__PURE__*/React.createElement(StatusBadge, {
      estado: "borrador",
      label: plantillaNombre(tpl),
      icon: "file-check"
    }), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost",
      onClick: () => setStep(0)
    }, "Cambiar plantilla")), /*#__PURE__*/React.createElement(Field, {
      label: "Nombre",
      defaultValue: "Stock bajo \u2014 Sucursal Norte"
    }), /*#__PURE__*/React.createElement(Field, {
      label: "Consulta guardada",
      as: "select",
      defaultValue: "q_31",
      help: "Solo se listan consultas guardadas del tenant activo."
    }, D.consultasGuardadas.map(c => /*#__PURE__*/React.createElement("option", {
      key: c.id,
      value: c.id
    }, c.nombre, " (v", c.version, ")"))), /*#__PURE__*/React.createElement("div", {
      className: "zd-form-row"
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Umbral (:umbral)",
      type: "number",
      defaultValue: 25,
      suffix: "unidades"
    }), /*#__PURE__*/React.createElement(Field, {
      label: "Dep\xF3sito (:deposito)",
      optional: true,
      defaultValue: "Sucursal Norte"
    })), /*#__PURE__*/React.createElement("div", {
      className: "zd-form-row"
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Frecuencia",
      as: "select",
      defaultValue: "diaria"
    }, /*#__PURE__*/React.createElement("option", {
      value: "diaria"
    }, "Todos los d\xEDas"), /*#__PURE__*/React.createElement("option", null, "Lunes a s\xE1bado"), /*#__PURE__*/React.createElement("option", null, "Cada 2 horas")), /*#__PURE__*/React.createElement(Field, {
      label: "Hora",
      type: "time",
      defaultValue: "08:00"
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Enviar a",
      type: "email",
      defaultValue: "compras@dontito.com.ar",
      help: "Separ\xE1 varios destinatarios con coma."
    }), /*#__PURE__*/React.createElement(Banner, {
      inline: true,
      tone: "info",
      title: "Se ejecuta por horario"
    }, "La primera ejecuci\xF3n ser\xE1 ma\xF1ana 04/10 a las 08:00."), /*#__PURE__*/React.createElement("div", {
      className: "zd-form-actions"
    }, /*#__PURE__*/React.createElement(Button, {
      icon: "arrow-left",
      onClick: () => setStep(0)
    }, "Volver"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      icon: "check",
      onClick: onDone
    }, "Crear automatizaci\xF3n"))), /*#__PURE__*/React.createElement(CorreoPreview, {
      plantilla: tpl
    })));
  }
  function ScreenAutomatizaciones() {
    const [mode, setMode] = React.useState('lista');
    const [created, setCreated] = React.useState(false);
    if (mode === 'alta') return /*#__PURE__*/React.createElement(Alta, {
      onCancel: () => setMode('lista'),
      onDone: () => {
        setCreated(true);
        setMode('lista');
      }
    });
    const cols = [{
      key: 'nombre',
      label: 'Automatización',
      render: (v, r) => /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", {
        style: {
          fontWeight: 600
        }
      }, v), /*#__PURE__*/React.createElement("span", {
        className: "zd-meta",
        style: {
          display: 'block'
        }
      }, plantillaNombre(r.plantilla), " \xB7 ", r.consulta))
    }, {
      key: 'horario',
      label: 'Horario'
    }, {
      key: 'destino',
      label: 'Destino',
      align: 'mono'
    }, {
      key: 'ultima',
      label: 'Última ejecución',
      render: (v, r) => /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'grid',
          gap: 2,
          justifyItems: 'start'
        }
      }, /*#__PURE__*/React.createElement(StatusBadge, {
        estado: v,
        attempt: v === 'reintentando' ? '2/3' : undefined
      }), /*#__PURE__*/React.createElement("span", {
        className: "zd-meta"
      }, r.ultimaHora))
    }, {
      key: 'proxima',
      label: 'Próxima',
      align: 'mono'
    }, {
      key: 'estado',
      label: 'Estado',
      render: v => /*#__PURE__*/React.createElement(StatusBadge, {
        estado: v
      })
    }];
    return /*#__PURE__*/React.createElement("section", {
      "data-screen-label": "Automatizaciones",
      "data-change": "CH-12 CH-13",
      "data-estado": "existe",
      style: {
        display: 'grid',
        gap: 'var(--space-6)'
      }
    }, /*#__PURE__*/React.createElement(PageHeader, {
      eyebrow: "Automatizaci\xF3n",
      title: "Automatizaciones",
      desc: "Ejecuciones programadas del tenant activo. No hay disparo por webhook.",
      change: "CH-12 \xB7 CH-13",
      estado: "EXISTE",
      actions: /*#__PURE__*/React.createElement(Button, {
        variant: "primary",
        icon: "plus",
        onClick: () => setMode('alta')
      }, "Nueva automatizaci\xF3n")
    }), created ? /*#__PURE__*/React.createElement(Banner, {
      tone: "ok",
      title: "Automatizaci\xF3n creada",
      onDismiss: () => setCreated(false)
    }, "\xABStock bajo \u2014 Sucursal Norte\xBB corre por primera vez ma\xF1ana a las 08:00.") : null, /*#__PURE__*/React.createElement(DataTable, {
      caption: "Automatizaciones",
      columns: cols,
      rows: D.automatizaciones,
      rowKey: "id"
    }));
  }
  window.ScreenAutomatizaciones = ScreenAutomatizaciones;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/consola/ScreenAutomatizaciones.jsx", error: String((e && e.message) || e) }); }

// ui_kits/consola/ScreenConsultas.jsx
try { (() => {
(() => {
  const {
    Icon,
    Button,
    Field,
    DataTable,
    Banner,
    LoadingState,
    EmptyState,
    StatusBadge
  } = window.ZeroDashboardDesignSystem_589ca0;
  const D = window.DATOS_MUESTRA;
  const RESULT_COLS = [{
    key: 'sku',
    label: 'sku',
    align: 'mono'
  }, {
    key: 'nombre',
    label: 'nombre'
  }, {
    key: 'deposito',
    label: 'deposito'
  }, {
    key: 'stock_actual',
    label: 'stock_actual',
    align: 'num'
  }, {
    key: 'stock_minimo',
    label: 'stock_minimo',
    align: 'num'
  }];
  function Resultado({
    sim,
    page,
    setPage
  }) {
    if (sim === 'cargando') return /*#__PURE__*/React.createElement("div", {
      className: "zd-card",
      style: {
        padding: 0
      }
    }, /*#__PURE__*/React.createElement(LoadingState, {
      label: "Ejecutando consulta\u2026"
    }));
    if (sim === 'rechazo') return /*#__PURE__*/React.createElement(Banner, {
      tone: "error",
      title: "La consulta fue rechazada: solo se permiten lecturas"
    }, "Se encontr\xF3 ", /*#__PURE__*/React.createElement("span", {
      className: "zd-mono"
    }, "UPDATE"), " en la l\xEDnea 3. Us\xE1 ", /*#__PURE__*/React.createElement("span", {
      className: "zd-mono"
    }, "SELECT"), " o ", /*#__PURE__*/React.createElement("span", {
      className: "zd-mono"
    }, "WITH \u2026 SELECT"), ".", /*#__PURE__*/React.createElement("pre", null, "ERROR  sentencia_no_lectura  l\xEDnea 3, columna 1"));
    if (sim === 'timeout') return /*#__PURE__*/React.createElement(Banner, {
      tone: "error",
      title: "La consulta super\xF3 el tiempo m\xE1ximo (30 s)",
      actions: /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        icon: "refresh-cw"
      }, "Reintentar")
    }, "La base del tenant no respondi\xF3 a tiempo. Prob\xE1 acotar el rango o agregar un filtro por \xEDndice.", /*#__PURE__*/React.createElement("pre", null, "ERROR  timeout  30.000 ms  ten_7f3a"));
    if (sim === 'vacio') return /*#__PURE__*/React.createElement("div", {
      className: "zd-card",
      style: {
        padding: 0
      }
    }, /*#__PURE__*/React.createElement(EmptyState, {
      icon: "table",
      title: "La consulta no devolvi\xF3 filas"
    }, "Con ", /*#__PURE__*/React.createElement("span", {
      className: "zd-mono"
    }, ":umbral = 25"), " ning\xFAn producto est\xE1 por debajo del m\xEDnimo."));
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 'var(--space-4)'
      }
    }, sim === 'tope' ? /*#__PURE__*/React.createElement(Banner, {
      inline: true,
      tone: "warn",
      title: "Tope de filas alcanzado"
    }, "Se muestran las primeras 1.000 filas de 4.812. Agreg\xE1 un filtro para ver el resto.") : null, /*#__PURE__*/React.createElement(DataTable, {
      compact: true,
      caption: "Resultado de la consulta",
      columns: RESULT_COLS,
      rows: D.productos,
      page: page,
      pageSize: 8,
      total: sim === 'tope' ? 1000 : D.productos.length,
      onPageChange: setPage,
      footerNote: /*#__PURE__*/React.createElement("span", {
        className: "zd-num"
      }, "1,8 s \xB7 solo lectura")
    }));
  }
  function Versiones({
    onClose
  }) {
    return /*#__PURE__*/React.createElement("aside", {
      className: "zd-card",
      "data-change": "CH-25",
      "data-estado": "pendiente",
      style: {
        display: 'grid',
        gap: 'var(--space-5)',
        alignContent: 'start'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "zd-card__head"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "zd-eyebrow"
    }, "CH-25 \xB7 pendiente"), /*#__PURE__*/React.createElement("h2", {
      className: "zd-h2"
    }, "Versiones")), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost",
      iconOnly: true,
      icon: "x",
      label: "Cerrar versiones",
      onClick: onClose
    })), /*#__PURE__*/React.createElement("ol", {
      style: {
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'grid',
        gap: 'var(--space-2)'
      }
    }, D.versiones.map((v, i) => /*#__PURE__*/React.createElement("li", {
      key: v.v,
      style: {
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 'var(--space-4)',
        alignItems: 'center',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        background: i === 0 ? 'var(--surface-selected)' : 'transparent'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "zd-tag"
    }, "v", v.v), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        display: 'block'
      }
    }, v.nota), /*#__PURE__*/React.createElement("span", {
      className: "zd-meta"
    }, v.fecha, " \xB7 ", v.autor)), i === 0 ? /*#__PURE__*/React.createElement(StatusBadge, {
      estado: "activa",
      label: "Actual"
    }) : /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost",
      icon: "git-compare"
    }, "Comparar")))));
  }
  function ScreenConsultas() {
    const [sel, setSel] = React.useState(D.consultasGuardadas[0].id);
    const [sim, setSim] = React.useState('exito');
    const [page, setPage] = React.useState(1);
    const [vers, setVers] = React.useState(false);
    const [running, setRunning] = React.useState(false);
    const q = D.consultasGuardadas.find(x => x.id === sel);
    const run = () => {
      setRunning(true);
      setTimeout(() => setRunning(false), 700);
    };
    return /*#__PURE__*/React.createElement("section", {
      "data-screen-label": "Consultas",
      "data-change": "CH-04 CH-05 CH-11",
      "data-estado": "existe",
      style: {
        display: 'grid',
        gap: 'var(--space-8)'
      }
    }, /*#__PURE__*/React.createElement(PageHeader, {
      eyebrow: "Datos",
      title: "Consultas",
      desc: "Editor de solo lectura sobre la base del tenant activo. Se rechaza toda sentencia que no sea de lectura.",
      change: "CH-04 \xB7 CH-05 \xB7 CH-11",
      estado: "EXISTE",
      actions: /*#__PURE__*/React.createElement(Button, {
        variant: "primary",
        icon: "plus"
      }, "Nueva consulta")
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: vers ? '240px minmax(0,1fr) 300px' : '240px minmax(0,1fr)',
        gap: 'var(--space-6)',
        alignItems: 'start'
      }
    }, /*#__PURE__*/React.createElement("aside", {
      "data-change": "CH-05",
      "data-estado": "existe",
      style: {
        display: 'grid',
        gap: 'var(--space-4)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "zd-eyebrow"
    }, "Consultas guardadas"), D.consultasGuardadas.map(c => /*#__PURE__*/React.createElement("button", {
      key: c.id,
      onClick: () => setSel(c.id),
      className: "zd-card",
      style: {
        textAlign: 'left',
        padding: 'var(--space-5)',
        cursor: 'pointer',
        font: 'inherit',
        color: 'inherit',
        borderColor: sel === c.id ? 'var(--accent)' : undefined,
        background: sel === c.id ? 'var(--surface-selected)' : undefined,
        boxShadow: 'none',
        display: 'grid',
        gap: 'var(--space-2)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600,
        fontSize: 'var(--text-sm)'
      }
    }, c.nombre), /*#__PURE__*/React.createElement("span", {
      className: "zd-meta"
    }, c.descripcion), /*#__PURE__*/React.createElement("span", {
      className: "zd-meta"
    }, "v", c.version, " \xB7 ", c.editada)))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 'var(--space-6)',
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "zd-card",
      style: {
        display: 'grid',
        gap: 'var(--space-6)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "zd-form-row"
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Nombre",
      defaultValue: q.nombre,
      key: 'n' + sel
    }), /*#__PURE__*/React.createElement(Field, {
      label: "Descripci\xF3n",
      optional: true,
      defaultValue: q.descripcion,
      key: 'd' + sel
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Consulta (solo lectura)",
      as: "textarea",
      mono: true,
      rows: 7,
      defaultValue: D.sqlEjemplo,
      help: "Par\xE1metros con dos puntos: :umbral. Tope: 1.000 filas \xB7 30 s."
    }), /*#__PURE__*/React.createElement("div", {
      "data-change": "CH-11",
      "data-estado": "existe",
      style: {
        display: 'grid',
        gap: 'var(--space-4)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "zd-label"
    }, "Par\xE1metros declarados"), D.parametros.map(p => /*#__PURE__*/React.createElement("div", {
      key: p.nombre,
      style: {
        display: 'grid',
        gridTemplateColumns: '140px 120px 1fr',
        gap: 'var(--space-5)',
        alignItems: 'end'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "zd-tag",
      style: {
        height: 'var(--control-h)',
        fontSize: 'var(--text-sm)'
      }
    }, ":", p.nombre), /*#__PURE__*/React.createElement(Field, {
      label: "Tipo",
      as: "select",
      defaultValue: p.tipo
    }, /*#__PURE__*/React.createElement("option", null, "entero"), /*#__PURE__*/React.createElement("option", null, "texto"), /*#__PURE__*/React.createElement("option", null, "fecha"), /*#__PURE__*/React.createElement("option", null, "decimal")), /*#__PURE__*/React.createElement(Field, {
      label: 'Valor de prueba' + (p.requerido ? '' : ''),
      optional: !p.requerido,
      defaultValue: p.valor,
      placeholder: "NULL"
    })))), /*#__PURE__*/React.createElement("div", {
      className: "zd-form-actions"
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      icon: "play",
      loading: running,
      onClick: run
    }, "Ejecutar consulta"), /*#__PURE__*/React.createElement(Button, {
      icon: "save"
    }, "Guardar"), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      icon: "history",
      onClick: () => setVers(v => !v),
      "aria-pressed": vers
    }, "Versiones"), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement("label", {
      className: "zd-meta",
      style: {
        display: 'flex',
        gap: 'var(--space-3)',
        alignItems: 'center'
      }
    }, "Simular estado (mockup)", /*#__PURE__*/React.createElement("select", {
      className: "zd-select",
      style: {
        width: 150,
        minHeight: 28
      },
      value: sim,
      onChange: e => setSim(e.target.value)
    }, /*#__PURE__*/React.createElement("option", {
      value: "exito"
    }, "\xC9xito"), /*#__PURE__*/React.createElement("option", {
      value: "tope"
    }, "Tope de filas"), /*#__PURE__*/React.createElement("option", {
      value: "vacio"
    }, "Sin filas"), /*#__PURE__*/React.createElement("option", {
      value: "cargando"
    }, "Cargando"), /*#__PURE__*/React.createElement("option", {
      value: "rechazo"
    }, "Rechazo (no lectura)"), /*#__PURE__*/React.createElement("option", {
      value: "timeout"
    }, "Timeout"))))), running ? /*#__PURE__*/React.createElement("div", {
      className: "zd-card",
      style: {
        padding: 0
      }
    }, /*#__PURE__*/React.createElement(LoadingState, {
      label: "Ejecutando consulta\u2026"
    })) : /*#__PURE__*/React.createElement(Resultado, {
      sim: sim,
      page: page,
      setPage: setPage
    })), vers ? /*#__PURE__*/React.createElement(Versiones, {
      onClose: () => setVers(false)
    }) : null));
  }
  window.ScreenConsultas = ScreenConsultas;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/consola/ScreenConsultas.jsx", error: String((e && e.message) || e) }); }

// ui_kits/consola/ScreenEjecuciones.jsx
try { (() => {
(() => {
  const {
    Icon,
    Button,
    Field,
    DataTable,
    Banner,
    StatusBadge
  } = window.ZeroDashboardDesignSystem_589ca0;
  const D = window.DATOS_MUESTRA;
  const DETALLE = {
    fallida: ['error', 'La ejecución falló'],
    reintentando: ['info', 'Reintentando (intento 2 de 3)'],
    omitida: ['neutral', 'Omitida por solapamiento'],
    interrumpida: ['warn', 'Ejecución interrumpida'],
    duplicado_evitado: ['neutral', 'Notificación duplicada evitada'],
    sin_datos: ['neutral', 'Sin datos: se envió el correo de "sin novedades"']
  };
  function Detalle({
    e,
    onClose
  }) {
    const d = DETALLE[e.estado];
    return /*#__PURE__*/React.createElement("aside", {
      className: "zd-card",
      "aria-label": 'Detalle de ' + e.id,
      style: {
        display: 'grid',
        gap: 'var(--space-6)',
        alignContent: 'start',
        position: 'sticky',
        top: 'calc(var(--tenantbar-h) + 24px)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "zd-card__head"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 'var(--space-2)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "zd-tag"
    }, e.id), /*#__PURE__*/React.createElement("h2", {
      className: "zd-h2"
    }, e.automatizacion)), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost",
      iconOnly: true,
      icon: "x",
      label: "Cerrar detalle",
      onClick: onClose
    })), /*#__PURE__*/React.createElement(StatusBadge, {
      estado: e.estado,
      attempt: e.intento
    }), /*#__PURE__*/React.createElement("dl", {
      className: "zd-kv"
    }, /*#__PURE__*/React.createElement("dt", null, "Inicio"), /*#__PURE__*/React.createElement("dd", {
      className: "zd-mono"
    }, e.inicio), /*#__PURE__*/React.createElement("dt", null, "Fin"), /*#__PURE__*/React.createElement("dd", {
      className: "zd-mono"
    }, e.fin), /*#__PURE__*/React.createElement("dt", null, "Duraci\xF3n"), /*#__PURE__*/React.createElement("dd", {
      className: "zd-num"
    }, e.duracion), /*#__PURE__*/React.createElement("dt", null, "Filas"), /*#__PURE__*/React.createElement("dd", {
      className: "zd-num"
    }, e.filas === null || e.filas === undefined ? '—' : e.filas)), d ? /*#__PURE__*/React.createElement(Banner, {
      inline: true,
      tone: d[0],
      title: d[1],
      icon: e.estado === 'duplicado_evitado' ? 'copy-check' : e.estado === 'omitida' ? 'skip-forward' : undefined
    }, e.estado === 'fallida' ? /*#__PURE__*/React.createElement("pre", null, e.error) : e.error || 'No hubo filas que cumplieran la condición.') : null, e.estado === 'fallida' ? /*#__PURE__*/React.createElement(Button, {
      icon: "database"
    }, "Abrir consulta") : null);
  }
  function ScreenEjecuciones() {
    const [sel, setSel] = React.useState(D.ejecuciones[0].id);
    const [filtro, setFiltro] = React.useState('');
    const [page, setPage] = React.useState(1);
    const rows = D.ejecuciones.filter(e => !filtro || e.estado === filtro);
    const e = D.ejecuciones.find(x => x.id === sel);
    const cols = [{
      key: 'id',
      label: 'Ejecución',
      align: 'mono'
    }, {
      key: 'automatizacion',
      label: 'Automatización'
    }, {
      key: 'inicio',
      label: 'Inicio',
      align: 'mono'
    }, {
      key: 'fin',
      label: 'Fin',
      align: 'mono'
    }, {
      key: 'duracion',
      label: 'Duración',
      align: 'num'
    }, {
      key: 'filas',
      label: 'Filas',
      align: 'num'
    }, {
      key: 'estado',
      label: 'Estado',
      render: (v, r) => /*#__PURE__*/React.createElement(StatusBadge, {
        estado: v,
        attempt: r.intento
      })
    }];
    return /*#__PURE__*/React.createElement("section", {
      "data-screen-label": "Ejecuciones",
      "data-change": "CH-13 CH-17a CH-17b CH-18",
      "data-estado": "existe",
      style: {
        display: 'grid',
        gap: 'var(--space-6)'
      }
    }, /*#__PURE__*/React.createElement(PageHeader, {
      eyebrow: "Automatizaci\xF3n",
      title: "Ejecuciones",
      desc: "Registro de cada corrida: inicio, fin, duraci\xF3n, filas, estado y error.",
      change: "CH-13 \xB7 CH-17a/b \xB7 CH-18",
      estado: "EXISTE",
      actions: /*#__PURE__*/React.createElement(Button, {
        icon: "refresh-cw"
      }, "Actualizar")
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 'var(--space-5)',
        alignItems: 'end',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 240
      }
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Automatizaci\xF3n",
      as: "select"
    }, /*#__PURE__*/React.createElement("option", null, "Todas"), D.automatizaciones.map(a => /*#__PURE__*/React.createElement("option", {
      key: a.id
    }, a.nombre)))), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 220
      }
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Estado",
      as: "select",
      value: filtro,
      onChange: ev => setFiltro(ev.target.value)
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "Todos"), /*#__PURE__*/React.createElement("option", {
      value: "exitosa"
    }, "Exitosa"), /*#__PURE__*/React.createElement("option", {
      value: "fallida"
    }, "Fallida"), /*#__PURE__*/React.createElement("option", {
      value: "reintentando"
    }, "Reintentando"), /*#__PURE__*/React.createElement("option", {
      value: "omitida"
    }, "Omitida por solapamiento"), /*#__PURE__*/React.createElement("option", {
      value: "interrumpida"
    }, "Interrumpida"), /*#__PURE__*/React.createElement("option", {
      value: "duplicado_evitado"
    }, "Duplicado evitado"), /*#__PURE__*/React.createElement("option", {
      value: "sin_datos"
    }, "Sin datos")))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: e ? 'minmax(0,1fr) 340px' : '1fr',
        gap: 'var(--space-6)',
        alignItems: 'start'
      }
    }, /*#__PURE__*/React.createElement(DataTable, {
      compact: true,
      caption: "Ejecuciones",
      columns: cols,
      rows: rows,
      rowKey: "id",
      selectedKey: sel,
      onRowClick: r => setSel(r.id),
      page: page,
      pageSize: 25,
      total: 312,
      onPageChange: setPage,
      nullLabel: "\u2014",
      emptyMessage: "No hay ejecuciones con ese estado."
    }), e ? /*#__PURE__*/React.createElement(Detalle, {
      e: e,
      onClose: () => setSel(null)
    }) : null));
  }
  window.ScreenEjecuciones = ScreenEjecuciones;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/consola/ScreenEjecuciones.jsx", error: String((e && e.message) || e) }); }

// ui_kits/consola/ScreenOperacion.jsx
try { (() => {
(() => {
  const {
    Icon,
    Button,
    Field,
    DataTable,
    Banner,
    StatusBadge,
    ConnectivityIndicator
  } = window.ZeroDashboardDesignSystem_589ca0;
  const D = window.DATOS_MUESTRA;
  function ScreenAgentes() {
    const [agentes, setAgentes] = React.useState(D.agentes.map(a => Object.assign({
      revocado: false
    }, a)));
    const [revocar, setRevocar] = React.useState(null);
    const [nuevo, setNuevo] = React.useState(null);
    const cols = [{
      key: 'tenant',
      label: 'Tenant',
      render: (v, r) => /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", {
        style: {
          fontWeight: 600
        }
      }, v), /*#__PURE__*/React.createElement("span", {
        className: "zd-meta",
        style: {
          display: 'block'
        }
      }, r.nombre))
    }, {
      key: 'estado',
      label: 'Conectividad',
      render: (v, r) => r.revocado ? /*#__PURE__*/React.createElement(StatusBadge, {
        estado: "pausada",
        icon: "ban",
        label: "Token revocado"
      }) : /*#__PURE__*/React.createElement(ConnectivityIndicator, {
        estado: v,
        ultimoLatido: r.latido
      })
    }, {
      key: 'token',
      label: 'Token',
      align: 'mono'
    }, {
      key: 'alta',
      label: 'Alta',
      align: 'mono'
    }, {
      key: 'id',
      label: '',
      render: (v, r) => r.revocado ? null : /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        variant: "ghost",
        icon: "key-round",
        onClick: () => setRevocar(r)
      }, "Revocar")
    }];
    return /*#__PURE__*/React.createElement("section", {
      "data-screen-label": "Agentes",
      "data-change": "CH-19b CH-19d1 CH-19d2",
      "data-estado": "pendiente",
      style: {
        display: 'grid',
        gap: 'var(--space-6)'
      }
    }, /*#__PURE__*/React.createElement(PageHeader, {
      eyebrow: "Operaci\xF3n",
      title: "Agentes y conectividad",
      desc: "Cada tenant conecta su base mediante un agente. Vista global: todos los tenants.",
      change: "CH-19b \xB7 CH-19d1 \xB7 CH-19d2",
      estado: "PENDIENTE",
      actions: /*#__PURE__*/React.createElement(Button, {
        variant: "primary",
        icon: "plus",
        onClick: () => setNuevo('zd_ag_5Qm2-7c1e-Rk9p-03bd')
      }, "Nuevo agente")
    }), /*#__PURE__*/React.createElement("div", {
      "data-change": "CH-19d2",
      "data-estado": "pendiente"
    }, /*#__PURE__*/React.createElement(Banner, {
      tone: "warn",
      title: "2 automatizaciones en riesgo: Panader\xEDa La Espiga no responde hace 3 h"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        marginBottom: 'var(--space-3)'
      }
    }, "Si el agente no vuelve antes de su horario, la ejecuci\xF3n va a fallar."), /*#__PURE__*/React.createElement("table", {
      className: "zd-table zd-table--compact",
      style: {
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Tenant"), /*#__PURE__*/React.createElement("th", null, "Automatizaci\xF3n"), /*#__PURE__*/React.createElement("th", null, "Pr\xF3xima ejecuci\xF3n"))), /*#__PURE__*/React.createElement("tbody", null, D.enRiesgo.map((r, i) => /*#__PURE__*/React.createElement("tr", {
      key: i
    }, /*#__PURE__*/React.createElement("td", null, r.tenant), /*#__PURE__*/React.createElement("td", null, r.automatizacion), /*#__PURE__*/React.createElement("td", {
      className: "is-mono"
    }, r.proxima))))))), nuevo ? /*#__PURE__*/React.createElement(Banner, {
      tone: "ok",
      title: "Agente creado. Copi\xE1 el token ahora: no se vuelve a mostrar.",
      onDismiss: () => setNuevo(null),
      actions: /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        icon: "copy"
      }, "Copiar")
    }, /*#__PURE__*/React.createElement("pre", null, nuevo)) : null, /*#__PURE__*/React.createElement(DataTable, {
      caption: "Agentes",
      columns: cols,
      rows: agentes,
      rowKey: "id"
    }), revocar ? /*#__PURE__*/React.createElement(Modal, {
      title: 'Revocar el token de ' + revocar.tenant,
      onClose: () => setRevocar(null),
      actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
        onClick: () => setRevocar(null)
      }, "Cancelar"), /*#__PURE__*/React.createElement(Button, {
        variant: "danger",
        icon: "key-round",
        onClick: () => {
          setAgentes(a => a.map(x => x.id === revocar.id ? Object.assign({}, x, {
            revocado: true
          }) : x));
          setRevocar(null);
        }
      }, "Revocar token"))
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0
      }
    }, "El agente ", /*#__PURE__*/React.createElement("b", null, revocar.nombre), " deja de conectarse de inmediato. Las automatizaciones de ", /*#__PURE__*/React.createElement("b", null, revocar.tenant), " fallar\xE1n hasta que se d\xE9 de alta un agente nuevo.")) : null);
  }
  function ScreenConexion() {
    const [test, setTest] = React.useState(null);
    const probar = () => {
      setTest('probando');
      setTimeout(() => setTest('ok'), 800);
    };
    const cols = [{
      key: 'entidad',
      label: 'Entidad',
      align: 'mono'
    }, {
      key: 'campo',
      label: 'Campo canónico',
      align: 'mono'
    }, {
      key: 'tipo',
      label: 'Tipo'
    }, {
      key: 'origen',
      label: 'Columna del tenant',
      render: v => v ? /*#__PURE__*/React.createElement("span", {
        className: "zd-mono"
      }, v) : /*#__PURE__*/React.createElement("select", {
        className: "zd-select",
        style: {
          minHeight: 28,
          width: 200
        },
        "aria-label": "Elegir columna"
      }, /*#__PURE__*/React.createElement("option", null, "Elegir columna\u2026"), /*#__PURE__*/React.createElement("option", null, "productos.minimo"), /*#__PURE__*/React.createElement("option", null, "stock.minimo"))
    }, {
      key: 'estado',
      label: 'Validación',
      render: (v, r) => v === 'ok' ? /*#__PURE__*/React.createElement(StatusBadge, {
        estado: "exitosa",
        label: "Mapeado"
      }) : v === 'falta' ? /*#__PURE__*/React.createElement(StatusBadge, {
        estado: "fallida",
        label: "Falta mapear"
      }) : /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'grid',
          gap: 2,
          justifyItems: 'start'
        }
      }, /*#__PURE__*/React.createElement(StatusBadge, {
        estado: "pausada",
        icon: "ban",
        label: "Inaplicable"
      }), /*#__PURE__*/React.createElement("span", {
        className: "zd-meta"
      }, r.motivo))
    }];
    return /*#__PURE__*/React.createElement("section", {
      "data-screen-label": "Conexi\xF3n y mapeo",
      "data-change": "CH-03 CH-09 CH-10",
      "data-estado": "parcial",
      style: {
        display: 'grid',
        gap: 'var(--space-8)'
      }
    }, /*#__PURE__*/React.createElement(PageHeader, {
      eyebrow: "Datos",
      title: "Conexi\xF3n y mapeo",
      desc: "Conexi\xF3n de solo lectura a la base del tenant y mapeo de su esquema al contrato can\xF3nico.",
      change: "CH-03 \xB7 CH-09 \xB7 CH-10",
      estado: "PARCIAL"
    }), /*#__PURE__*/React.createElement("div", {
      className: "zd-card zd-form",
      "data-change": "CH-03",
      "data-estado": "parcial"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "zd-h2"
    }, "Conexi\xF3n"), /*#__PURE__*/React.createElement("div", {
      className: "zd-form-row"
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Host",
      defaultValue: "replica.dontito.local",
      mono: true
    }), /*#__PURE__*/React.createElement(Field, {
      label: "Puerto",
      type: "number",
      defaultValue: 5432
    }), /*#__PURE__*/React.createElement(Field, {
      label: "Base",
      defaultValue: "tienda",
      mono: true
    })), /*#__PURE__*/React.createElement("div", {
      className: "zd-form-row"
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Usuario (solo lectura)",
      defaultValue: "zd_lectura",
      mono: true
    }), /*#__PURE__*/React.createElement(Field, {
      label: "Contrase\xF1a",
      type: "password",
      defaultValue: "secreto"
    })), /*#__PURE__*/React.createElement("div", {
      className: "zd-form-actions"
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      icon: "plug",
      loading: test === 'probando',
      onClick: probar
    }, "Probar conexi\xF3n"), /*#__PURE__*/React.createElement(Button, {
      icon: "save"
    }, "Guardar")), test === 'ok' ? /*#__PURE__*/React.createElement(Banner, {
      inline: true,
      tone: "ok",
      title: "Conexi\xF3n exitosa \xB7 42 ms"
    }, "El usuario tiene permisos de solo lectura. PostgreSQL 15.4 \xB7 38 tablas visibles.") : null), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gap: 'var(--space-5)'
      },
      "data-change": "CH-09 CH-10",
      "data-estado": "parcial"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-5)'
      }
    }, /*#__PURE__*/React.createElement("h2", {
      className: "zd-h2",
      style: {
        flex: 1
      }
    }, "Mapeo de esquema"), /*#__PURE__*/React.createElement(Button, {
      icon: "file-check"
    }, "Validar mapeo")), /*#__PURE__*/React.createElement(Banner, {
      inline: true,
      tone: "warn",
      title: "1 campo requerido sin mapear"
    }, "Sin ", /*#__PURE__*/React.createElement("span", {
      className: "zd-mono"
    }, "producto.stock_minimo"), " no se puede usar la plantilla \xABAlerta de stock f\xEDsico\xBB."), /*#__PURE__*/React.createElement(DataTable, {
      compact: true,
      caption: "Mapeo",
      columns: cols,
      rows: D.mapeo
    })));
  }
  function ScreenSinMockup({
    titulo,
    change,
    estado,
    desc
  }) {
    const {
      EmptyState
    } = window.ZeroDashboardDesignSystem_589ca0;
    return /*#__PURE__*/React.createElement("section", {
      "data-screen-label": titulo,
      "data-change": change,
      "data-estado": estado.toLowerCase(),
      style: {
        display: 'grid',
        gap: 'var(--space-6)'
      }
    }, /*#__PURE__*/React.createElement(PageHeader, {
      eyebrow: "Especificada, sin mockup",
      title: titulo,
      desc: desc,
      change: change,
      estado: estado
    }), /*#__PURE__*/React.createElement("div", {
      className: "zd-card",
      style: {
        padding: 0
      }
    }, /*#__PURE__*/React.createElement(EmptyState, {
      icon: "file-text",
      title: "Pantalla especificada sin mockup"
    }, "La especificaci\xF3n (prop\xF3sito, datos, estados y acciones) est\xE1 en guidelines/pantallas.md. Compon\xE9 la pantalla con DataTable, Field, Banner y StatusBadge.")));
  }
  Object.assign(window, {
    ScreenAgentes,
    ScreenConexion,
    ScreenSinMockup
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/consola/ScreenOperacion.jsx", error: String((e && e.message) || e) }); }

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

__ds_ns.ConnectivityIndicator = __ds_scope.ConnectivityIndicator;

__ds_ns.TenantBar = __ds_scope.TenantBar;

})();

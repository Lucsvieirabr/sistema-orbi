-- Migration: Update categories icons from Font Awesome to Lucide React
-- This migration converts existing Font Awesome icon names to Lucide React icon names

BEGIN;

-- Update expense categories (Gastos)
UPDATE public.categories SET icon = 'utensils' WHERE icon = 'fa-utensils';
UPDATE public.categories SET icon = 'sparkles' WHERE icon = 'fa-spa';
UPDATE public.categories SET icon = 'home' WHERE icon = 'fa-home';
UPDATE public.categories SET icon = 'wrench' WHERE icon = 'fa-user-tie';
UPDATE public.categories SET icon = 'user' WHERE icon = 'fa-user';
UPDATE public.categories SET icon = 'credit-card' WHERE icon = 'fa-credit-card';
UPDATE public.categories SET icon = 'plane' WHERE icon = 'fa-plane';
UPDATE public.categories SET icon = 'baby' WHERE icon = 'fa-child';
UPDATE public.categories SET icon = 'chart-line' WHERE icon = 'fa-chart-line';
UPDATE public.categories SET icon = 'briefcase' WHERE icon = 'fa-briefcase';
UPDATE public.categories SET icon = 'gamepad' WHERE icon = 'fa-gamepad';
UPDATE public.categories SET icon = 'more-horizontal' WHERE icon = 'fa-ellipsis-h';
UPDATE public.categories SET icon = 'dog' WHERE icon = 'fa-paw';
UPDATE public.categories SET icon = 'gift' WHERE icon = 'fa-gift';
UPDATE public.categories SET icon = 'shirt' WHERE icon = 'fa-tshirt';
UPDATE public.categories SET icon = 'heart' WHERE icon = 'fa-heartbeat';
UPDATE public.categories SET icon = 'receipt' WHERE icon = 'fa-file-invoice-dollar';
UPDATE public.categories SET icon = 'smartphone' WHERE icon = 'fa-mobile-alt';
UPDATE public.categories SET icon = 'car' WHERE icon = 'fa-car';
UPDATE public.categories SET icon = 'coffee' WHERE icon = 'fa-coffee';
UPDATE public.categories SET icon = 'stethoscope' WHERE icon = 'fa-stethoscope';
UPDATE public.categories SET icon = 'pill' WHERE icon = 'fa-pills';

-- Update income categories (Ganhos)
UPDATE public.categories SET icon = 'handshake' WHERE icon = 'fa-handshake';
UPDATE public.categories SET icon = 'percent' WHERE icon = 'fa-percentage';
UPDATE public.categories SET icon = 'plus-circle' WHERE icon = 'fa-plus-circle';

-- Update any other common Font Awesome icons that might exist
UPDATE public.categories SET icon = 'shopping-bag' WHERE icon = 'fa-shopping-bag';
UPDATE public.categories SET icon = 'shopping-cart' WHERE icon = 'fa-shopping-cart';
UPDATE public.categories SET icon = 'wallet' WHERE icon = 'fa-wallet';
UPDATE public.categories SET icon = 'coins' WHERE icon = 'fa-coins';
UPDATE public.categories SET icon = 'dollar-sign' WHERE icon = 'fa-dollar-sign';
UPDATE public.categories SET icon = 'trending-up' WHERE icon = 'fa-arrow-trend-up';
UPDATE public.categories SET icon = 'trending-down' WHERE icon = 'fa-arrow-trend-down';
UPDATE public.categories SET icon = 'building' WHERE icon = 'fa-building';
UPDATE public.categories SET icon = 'store' WHERE icon = 'fa-store';
UPDATE public.categories SET icon = 'graduation-cap' WHERE icon = 'fa-graduation-cap';
UPDATE public.categories SET icon = 'book-open' WHERE icon = 'fa-book';
UPDATE public.categories SET icon = 'music' WHERE icon = 'fa-music';
UPDATE public.categories SET icon = 'camera' WHERE icon = 'fa-camera';
UPDATE public.categories SET icon = 'tv' WHERE icon = 'fa-tv';
UPDATE public.categories SET icon = 'wifi' WHERE icon = 'fa-wifi';
UPDATE public.categories SET icon = 'fuel' WHERE icon = 'fa-gas-pump';
UPDATE public.categories SET icon = 'train' WHERE icon = 'fa-train';
UPDATE public.categories SET icon = 'bus' WHERE icon = 'fa-bus';
UPDATE public.categories SET icon = 'bike' WHERE icon = 'fa-bicycle';

COMMIT;


import { defineConfig } from 'astro/config';

export default defineConfig({
  // Принудительно собираем сайт как статический HTML
  output: 'static', 
  
  // Указываем правильный базовый адрес вашего профиля
  site: 'https://burdianove.github.io',
  
  // Указываем точное имя папки вашего репозитория (обязательно со слэшем в начале)
  base: '/studance', 
});

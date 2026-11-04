const messages: Record<string, string> = {
  AUTH_REQUIRED: 'Сессия завершена. Войдите снова.',
  FORBIDDEN: 'Недостаточно прав для этого действия.',
  NOT_AVAILABLE: 'Запись удалена или больше недоступна.',
  STALE_DATA: 'Данные изменились. Обновите страницу и повторите действие.',
  INVALID_TRANSITION:
    'Этот переход статуса сейчас недоступен. Обновите данные.',
  WORKER_REQUIRED: 'Выберите существующего исполнителя.',
  REVISION_COMMENT_REQUIRED: 'Укажите причину возврата на доработку.',
  COMMENT_TOO_LONG: 'Комментарий не должен превышать 2000 символов.',
  HISTORY_IMMUTABLE: 'История изменяется только базой данных.',
  CONFIG_REQUIRED: 'Укажите настройки Supabase в файле .env.',
};

export function errorText(error: unknown): string {
  const value =
    error && typeof error === 'object'
      ? (error as { message?: string; code?: string })
      : {};
  const message = value.message ?? '';
  for (const [token, text] of Object.entries(messages))
    if (message.includes(token)) return text;
  if (message.includes('Invalid login credentials'))
    return 'Неверный email или пароль.';
  if (message.includes('Email not confirmed'))
    return 'Администратор должен подтвердить email учётной записи.';
  if (value.code === '23503')
    return 'Связанная запись недоступна или её роль изменилась. Обновите данные.';
  if (value.code === '23514' || value.code === '23502')
    return 'Проверьте обязательные поля и допустимую длину текста.';
  if (value.code === '42501')
    return 'Недостаточно прав. Обновите данные или войдите снова.';
  if (value.code === '22P02') return 'Некорректный адрес записи.';
  if (value.code === '40P01' || value.code === '40001')
    return 'Данные меняются другим пользователем. Обновите страницу и повторите действие.';
  if (/TimeoutError|AbortError|timed out|aborted/i.test(message))
    return 'Сервер не ответил вовремя. Операция могла завершиться: обновите данные перед повторной попыткой.';
  if (/fetch|network|Failed to fetch/i.test(message))
    return 'Нет связи с сервером. Проверьте подключение и повторите попытку.';
  return 'Не удалось выполнить запрос. Повторите попытку. Если ошибка сохраняется, обратитесь к администратору.';
}

import { generatePath } from 'react-router-dom';

export const routes = {
  home: '/',
  login: '/login',
  objects: '/objects',
  myTasks: '/my-tasks',
  object: {
    pattern: '/objects/:id',
    path: (id: string): string =>
      generatePath(routes.object.pattern, { id: encodeURIComponent(id) }),
  },
  task: {
    pattern: '/tasks/:id',
    path: (id: string): string =>
      generatePath(routes.task.pattern, { id: encodeURIComponent(id) }),
  },
  notFound: '*',
} as const;

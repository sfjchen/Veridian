import { Platform } from 'react-native';

export const DOT_CURSOR =
  'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%278%27 height=%278%27%3E%3Ccircle cx=%274%27 cy=%274%27 r=%273%27 fill=%27%23333%27/%3E%3C/svg%3E") 4 4, crosshair';

export const WEB_CURSOR_STYLE: object | undefined =
  Platform.OS === 'web' ? { cursor: DOT_CURSOR } : undefined;

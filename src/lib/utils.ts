import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { parseISO } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const DIAS_SEMANA_ORDEN = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo'
];

export function getDiaSemanaName(diaSemanaField?: string, fecha?: string | Date): string {
  if (diaSemanaField && typeof diaSemanaField === 'string' && diaSemanaField.trim()) {
    const raw = diaSemanaField.trim().toUpperCase();
    if (raw.startsWith('LUN')) return 'Lunes';
    if (raw.startsWith('MAR')) return 'Martes';
    if (raw.startsWith('MIE') || raw.startsWith('MIÉ')) return 'Miércoles';
    if (raw.startsWith('JUE')) return 'Jueves';
    if (raw.startsWith('VIE')) return 'Viernes';
    if (raw.startsWith('SAB') || raw.startsWith('SÁB')) return 'Sábado';
    if (raw.startsWith('DOM')) return 'Domingo';
  }

  if (!fecha) return '';
  let dateObj: Date | null = null;
  if (typeof fecha === 'string') {
    const trimmed = fecha.trim();
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        } else if (parts[2].length === 4) {
          dateObj = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        }
      }
    } else if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          dateObj = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        } else if (parts[0].length === 4) {
          dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        }
      }
    }
    if (!dateObj || isNaN(dateObj.getTime())) {
      dateObj = parseISO(trimmed);
    }
  } else if (fecha instanceof Date) {
    dateObj = fecha;
  }

  if (dateObj && !isNaN(dateObj.getTime())) {
    const dayIdx = dateObj.getDay(); // 0: Domingo, 1: Lunes, 2: Martes, 3: Miércoles, 4: Jueves, 5: Viernes, 6: Sábado
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dayNames[dayIdx];
  }

  return '';
}

export const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function getMesName(fecha?: string | Date): string {
  if (!fecha) return '';
  let dateObj: Date | null = null;
  if (typeof fecha === 'string') {
    const trimmed = fecha.trim();
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      if (parts.length >= 2) {
        if (parts[0].length === 4) {
          const monthNum = parseInt(parts[1], 10);
          if (monthNum >= 1 && monthNum <= 12) {
            return `${MESES_NOMBRES[monthNum - 1]} ${parts[0]}`;
          }
        } else if (parts[2]?.length === 4) {
          const monthNum = parseInt(parts[1], 10);
          if (monthNum >= 1 && monthNum <= 12) {
            return `${MESES_NOMBRES[monthNum - 1]} ${parts[2]}`;
          }
        }
      }
    } else if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length >= 2) {
        if (parts[2]?.length === 4) {
          const monthNum = parseInt(parts[1], 10);
          if (monthNum >= 1 && monthNum <= 12) {
            return `${MESES_NOMBRES[monthNum - 1]} ${parts[2]}`;
          }
        }
      }
    }
    dateObj = parseISO(trimmed);
  } else if (fecha instanceof Date) {
    dateObj = fecha;
  }

  if (dateObj && !isNaN(dateObj.getTime())) {
    const month = MESES_NOMBRES[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    return `${month} ${year}`;
  }

  return '';
}

export function sortMeses(meses: string[]): string[] {
  return [...meses].sort((a, b) => {
    const partsA = a.split(' ');
    const partsB = b.split(' ');
    const yearA = parseInt(partsA[1] || '0', 10);
    const yearB = parseInt(partsB[1] || '0', 10);
    if (yearA !== yearB) return yearA - yearB;
    const idxA = MESES_NOMBRES.indexOf(partsA[0]);
    const idxB = MESES_NOMBRES.indexOf(partsB[0]);
    return idxA - idxB;
  });
}


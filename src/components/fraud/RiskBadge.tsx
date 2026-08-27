import React from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert, HelpCircle } from 'lucide-react';
import { RiskLevel } from '../../../server/types/fraudChecker';

interface RiskBadgeProps {
  level: RiskLevel;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function RiskBadge({ level, size = 'md', showIcon = true, className = '' }: RiskBadgeProps) {
  let config = {
    label: 'UNKNOWN',
    banglaLabel: 'অজানা',
    bgColor: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    icon: HelpCircle,
    iconColor: 'text-slate-500',
    dotColor: 'bg-slate-400'
  };

  if (level === 'LOW') {
    config = {
      label: 'LOW RISK',
      banglaLabel: 'নিরাপদ গ্রাহক',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60',
      icon: ShieldCheck,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      dotColor: 'bg-emerald-500'
    };
  } else if (level === 'MEDIUM') {
    config = {
      label: 'MEDIUM RISK',
      banglaLabel: 'মাঝারি ঝুঁকি',
      bgColor: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60',
      icon: AlertTriangle,
      iconColor: 'text-amber-600 dark:text-amber-400',
      dotColor: 'bg-amber-500'
    };
  } else if (level === 'HIGH') {
    config = {
      label: 'HIGH RISK',
      banglaLabel: 'উচ্চ ঝুঁকি',
      bgColor: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60',
      icon: ShieldAlert,
      iconColor: 'text-rose-600 dark:text-rose-400',
      dotColor: 'bg-rose-500 animate-pulse'
    };
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs font-semibold px-2.5 py-1 gap-1.5',
    lg: 'text-sm font-bold px-3.5 py-1.5 gap-2'
  };

  const IconComponent = config.icon;

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-sm ${config.bgColor} ${sizeClasses[size]} ${className}`}
    >
      {showIcon && <IconComponent className={size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />}
      <span>{config.label}</span>
    </span>
  );
}

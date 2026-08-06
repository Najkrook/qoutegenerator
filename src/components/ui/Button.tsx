import React, { forwardRef, type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    size?: ButtonSize;
    variant?: ButtonVariant;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
    primary: 'border-action bg-action text-on-action hover:border-action-hover hover:bg-action-hover',
    secondary: 'border-control-border bg-surface-raised text-text hover:bg-surface-hover',
    danger: 'border-danger-solid bg-danger-solid text-on-action hover:brightness-90',
    ghost: 'border-transparent bg-transparent text-text-muted hover:bg-hover hover:text-text'
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
    sm: 'min-h-9 px-3 py-2 text-xs',
    md: 'min-h-10 px-4 py-2.5 text-sm',
    lg: 'min-h-12 px-6 py-3 text-sm'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
    className = '',
    size = 'md',
    type = 'button',
    variant = 'secondary',
    ...props
}, ref) {
    return (
        <button
            ref={ref}
            type={type}
            className={[
                'inline-flex items-center justify-center rounded-control border font-semibold transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
                VARIANT_CLASSES[variant],
                SIZE_CLASSES[size],
                className
            ].join(' ')}
            {...props}
        />
    );
});

'use client';
import React from 'react';
import { tva } from '@gluestack-ui/utils/nativewind-utils';
import { Platform, View } from 'react-native';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { styled } from 'nativewind';

const DividerBase = styled(View, {
  // default base classes can be passed as the second argument
  base: 'h-[1px] w-full bg-slate-200',
} as any) as React.ForwardRefExoticComponent<React.PropsWithoutRef<React.ComponentProps<typeof View>> & React.RefAttributes<any>>;

const dividerStyle = tva({
  base: 'bg-border',
  variants: {
    orientation: {
      vertical: 'w-px h-full',
      horizontal: 'h-px w-auto',
    },
  },
});


type IUIDividerProps = React.ComponentPropsWithoutRef<typeof View> &
  VariantProps<typeof dividerStyle>;

const Divider = React.forwardRef<
  React.ComponentRef<typeof View>,
  IUIDividerProps
>(function Divider({ className, orientation = 'horizontal', ...props }, ref) {
  return (
    <DividerBase
      ref={ref}
      {...props}
      aria-orientation={orientation}
      role={Platform.OS === 'web' ? 'separator' : undefined}
      className={dividerStyle({
        orientation,
        class: className,
      })}
    />
  );
});

Divider.displayName = 'Divider';

export { Divider };

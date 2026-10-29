
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				heading: ['Fraunces', 'Georgia', 'serif'],
				body: ['DM Sans', 'system-ui', 'sans-serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				warning: 'hsl(var(--warning))',
				info: 'hsl(var(--info))',
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				education: {
					DEFAULT: 'hsl(var(--brand) / <alpha-value>)',
					light: 'hsl(var(--brand-light) / <alpha-value>)',
					dark: 'hsl(var(--brand-dark) / <alpha-value>)',
					muted: 'hsl(var(--brand-muted) / <alpha-value>)',
				},
				sun: {
					DEFAULT: 'hsl(var(--sun) / <alpha-value>)',
					light: 'hsl(var(--sun-light) / <alpha-value>)',
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'zoom-in': {
					'0%': {
						transform: 'scale(1)',
					},
					'100%': {
						transform: 'scale(1.05)',
					}
				},
				'zoom-out': {
					'0%': {
						transform: 'scale(1.05)',
					},
					'100%': {
						transform: 'scale(1)',
					}
				},
				'fade-out': {
					'0%': {
						opacity: '1',
					},
					'100%': {
						opacity: '0',
					}
				},
				'fade-in': {
					'0%': {
						opacity: '0',
					},
					'100%': {
						opacity: '1',
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'zoom-in': 'zoom-in 0.3s ease-out',
				'zoom-out': 'zoom-out 0.3s ease-out',
				'fade-out': 'fade-out 0.3s ease',
				'fade-in': 'fade-in 0.3s ease'
			}
		}
	},
		plugins: [tailwindcssAnimate],
	} satisfies Config;

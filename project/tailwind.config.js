/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', './utils/**/*.{ts,tsx}'],
  theme: {
  	container: {
  		center: true,
  		padding: '1.5rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			surface: 'hsl(var(--surface))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))',
  				hover: 'hsl(var(--primary-hover))',
  				subtle: 'hsl(var(--primary-subtle))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
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
  			sev: {
  				contraindicated: {
  					DEFAULT: 'hsl(var(--sev-contraindicated))',
  					bg: 'hsl(var(--sev-contraindicated-bg))',
  					border: 'hsl(var(--sev-contraindicated-border))'
  				},
  				major: {
  					DEFAULT: 'hsl(var(--sev-major))',
  					bg: 'hsl(var(--sev-major-bg))',
  					border: 'hsl(var(--sev-major-border))'
  				},
  				moderate: {
  					DEFAULT: 'hsl(var(--sev-moderate))',
  					bg: 'hsl(var(--sev-moderate-bg))',
  					border: 'hsl(var(--sev-moderate-border))'
  				},
  				minor: {
  					DEFAULT: 'hsl(var(--sev-minor))',
  					bg: 'hsl(var(--sev-minor-bg))',
  					border: 'hsl(var(--sev-minor-border))'
  				},
  				clear: {
  					DEFAULT: 'hsl(var(--sev-clear))',
  					bg: 'hsl(var(--sev-clear-bg))',
  					border: 'hsl(var(--sev-clear-border))'
  				},
  				unknown: {
  					DEFAULT: 'hsl(var(--sev-unknown))',
  					bg: 'hsl(var(--sev-unknown-bg))',
  					border: 'hsl(var(--sev-unknown-border))'
  				}
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 4px)',
  			sm: 'calc(var(--radius) - 6px)'
  		},
  		fontFamily: {
  			sans: [
  				'Inter var',
  				'Inter',
  				'ui-sans-serif',
  				'system-ui',
  				'-apple-system',
  				'Segoe UI',
  				'Roboto',
  				'sans-serif'
  			]
  		},
  		fontSize: {
  			'display-lg': [
  				'2rem',
  				{
  					lineHeight: '2.375rem',
  					letterSpacing: '-0.02em',
  					fontWeight: '600'
  				}
  			],
  			display: [
  				'1.5rem',
  				{
  					lineHeight: '1.875rem',
  					letterSpacing: '-0.02em',
  					fontWeight: '600'
  				}
  			],
  			section: [
  				'1.125rem',
  				{
  					lineHeight: '1.5rem',
  					letterSpacing: '-0.01em',
  					fontWeight: '600'
  				}
  			],
  			label: [
  				'0.8125rem',
  				{
  					lineHeight: '1.125rem',
  					letterSpacing: '0.01em',
  					fontWeight: '500'
  				}
  			]
  		},
  		boxShadow: {
  			card: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.06)'
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
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require('tailwindcss-animate')],
};

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
  			// UI and body. Legible at small sizes, and deliberately not the face
  			// that carries the personality.
  			sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
  			// Display. Set heavy and tight -- the character comes from the
  			// treatment, not from a novelty face.
  			display: ['Archivo', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  			// Doses, counts, grades, eyebrows. A dose is a measured value, and
  			// monospace is how measured values are set. Plex Mono was drawn for
  			// technical documentation, which is the register this product lives in.
  			mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
  		},
		fontSize: {
  			'display-xl': ['clamp(2.75rem, 6vw, 4.5rem)', { lineHeight: '0.95', letterSpacing: '-0.045em', fontWeight: '700' }],
  			'display-lg': ['clamp(2rem, 3.6vw, 2.75rem)', { lineHeight: '1.04', letterSpacing: '-0.035em', fontWeight: '700' }],
  			display: ['1.625rem', { lineHeight: '1.15', letterSpacing: '-0.028em', fontWeight: '650' }],
  			section: ['1.0625rem', { lineHeight: '1.4', letterSpacing: '-0.012em', fontWeight: '600' }],
  			// Eyebrows and column headers. Mono, wide-tracked, small.
  			label: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.09em', fontWeight: '500' }]
  		},
		boxShadow: {
  			// Surfaces separate by rule and tone. This is a whisper, kept only for
  			// things that genuinely float above the page: popovers, the palette.
  			card: '0 1px 2px rgba(11,13,14,0.04)',
  			float: '0 8px 32px -8px rgba(11,13,14,0.14), 0 2px 8px -2px rgba(11,13,14,0.06)'
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

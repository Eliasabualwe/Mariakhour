<?php
/**
 * Plugin Name: Souriana Hero Shelf
 * Description: Animated curved product shelf at the top of the homepage only. Shows best-selling products in order; visitors can drag through them. Does not change any other page, product, price or setting. Deactivate to remove it completely.
 * Version: 1.5.1
 * Author: Souriana Golden
 * Requires PHP: 7.4
 * Text Domain: souriana-hero-shelf
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Souriana_Hero_Shelf {

	const VERSION   = '1.5.1';
	const CACHE_KEY = 'souriana_hero_shelf_products_v1';
	const CATS_KEY  = 'souriana_hero_shelf_aisles_v1';
	const MAX_ITEMS = 14;

	private static $printed = false;

	public static function init() {
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'assets' ) );
		// Woodmart prints this hook right inside .main-page-wrapper, under the header.
		add_action( 'woodmart_after_header', array( __CLASS__, 'render_in_place' ), 1 );
		// Fallback for any other layout: print in the footer and move it under the header with JS.
		add_action( 'wp_footer', array( __CLASS__, 'render_fallback' ), 1 );

		// Refresh the shelf when products change.
		add_action( 'save_post_product', array( __CLASS__, 'flush' ) );
		add_action( 'woocommerce_update_product', array( __CLASS__, 'flush' ) );
		add_action( 'woocommerce_new_order', array( __CLASS__, 'flush' ) );
	}

	private static function enabled() {
		return ! is_admin() && is_front_page() && class_exists( 'WooCommerce' );
	}

	public static function flush() {
		delete_transient( self::CACHE_KEY );
		delete_transient( self::CATS_KEY );
	}

	public static function assets() {
		$url = plugin_dir_url( __FILE__ ) . 'assets/';
		if ( ! is_admin() ) {
			// Header "Become a customer" button style: on every page, because the header is.
			wp_enqueue_style( 'souriana-header-button', $url . 'header.css', array(), self::VERSION );
		}
		if ( ! self::enabled() ) {
			return;
		}
		wp_enqueue_style(
			'souriana-hero-shelf-fonts',
			'https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@700&family=Caveat:wght@600&family=Inter+Tight:wght@700&family=Inter:wght@400;500&display=swap',
			array(),
			null
		);
		wp_enqueue_style( 'souriana-hero-shelf', $url . 'shelf.css', array(), self::VERSION );
		wp_enqueue_script( 'souriana-hero-shelf', $url . 'shelf.js', array(), self::VERSION, true );
		wp_enqueue_style( 'souriana-hero-aisles', $url . 'aisles.css', array(), self::VERSION );
		wp_enqueue_script( 'souriana-hero-aisles', $url . 'aisles.js', array(), self::VERSION, true );
	}

	/** Arabic names shown under each category (by slug). */
	private static function arabic_names() {
		return array(
			'snacks-and-sweets'   => 'سناكات وحلويات',
			'hot-drinks'          => 'المشروبات الساخنة',
			'spices'              => 'بهارات',
			'pickles'             => 'مخللات',
			'sauces-and-dressing' => 'صلصات وتتبيلات',
			'canned-products'     => 'المعلبات',
			'drinks'              => 'المشروبات',
			'meat-and-fish'       => 'لحوم وأسماك',
			'household-products'  => 'منتجات منزلية',
			'nuts-and-seeds'      => 'مكسرات وبذور',
			'dairy-products'      => 'منتجات الألبان',
			'dried-products'      => 'التمور والمجففات',
			'jam'                 => 'مربيات',
			'grains-and-cereals'  => 'حبوب وبقوليات',
			'tahini-and-halva'    => 'طحينة وحلاوة',
			'rice'                => 'الأرز',
			'olives'              => 'زيتون',
			'zaatar'              => 'زعتر',
			'charcoal'            => 'فحم',
			'noodles'             => 'نودلز',
			'egs'                 => 'بيض',
		);
	}

	/** Top-level product categories with products, largest first. */
	private static function aisles() {
		$cached = get_transient( self::CATS_KEY );
		if ( is_array( $cached ) ) {
			return $cached;
		}
		$terms = get_terms(
			array(
				'taxonomy'   => 'product_cat',
				'parent'     => 0,
				'hide_empty' => true,
				'orderby'    => 'count',
				'order'      => 'DESC',
				'number'     => 24,
			)
		);
		$ar    = self::arabic_names();
		$items = array();
		if ( ! is_wp_error( $terms ) ) {
			foreach ( $terms as $t ) {
				if ( 'uncategorized' === $t->slug ) {
					continue;
				}
				$link = get_term_link( $t );
				if ( is_wp_error( $link ) ) {
					continue;
				}
				$items[] = array(
					'slug'  => $t->slug,
					'name'  => html_entity_decode( $t->name, ENT_QUOTES, 'UTF-8' ),
					'ar'    => isset( $ar[ $t->slug ] ) ? $ar[ $t->slug ] : '',
					'count' => (int) $t->count,
					'url'   => $link,
				);
			}
		}
		set_transient( self::CATS_KEY, $items, HOUR_IN_SECONDS );
		return $items;
	}

	private static function icon( $slug ) {
		static $icons = null;
		if ( null === $icons ) {
			$raw   = file_get_contents( __DIR__ . '/assets/aisle-icons.json' ); // phpcs:ignore WordPress.WP.AlternativeFunctions
			$icons = $raw ? json_decode( $raw, true ) : array();
			if ( ! is_array( $icons ) ) {
				$icons = array();
			}
		}
		$svg = isset( $icons[ $slug ] ) ? $icons[ $slug ] : ( isset( $icons['_default'] ) ? $icons['_default'] : '' );
		return '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">' . $svg . '</svg>';
	}

	private static function aisles_markup() {
		$cats = self::aisles();
		$n    = count( $cats );
		if ( $n < 3 ) {
			return '';
		}
		$shop = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/shop/' );
		// "All products" always comes first.
		array_unshift(
			$cats,
			array(
				'slug' => '_all',
				'name' => 'All products',
				'ar'   => 'كل المنتجات',
				'url'  => $shop,
				'all'  => true,
			)
		);
		$n     = count( $cats );
		$sizes = array( 0, 1, 2, 1 );
		$arrow = '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
		ob_start();
		?>
<section id="sha" class="sha" aria-label="Shop by category">
	<div class="sha-wrap">
		<div class="sha-head">
			<div>
				<p class="sha-kicker">Browse by aisle · تسوّق حسب القسم</p>
				<h2 class="sha-title">Every aisle, <em>one swipe away</em></h2>
			</div>
			<div class="sha-nav">
				<a class="sha-all" href="<?php echo esc_url( $shop ); ?>">View all products · كل المنتجات<span class="sha-all-ic"><?php echo $arrow; // phpcs:ignore WordPress.Security.EscapeOutput ?></span></a>
				<span class="sha-count"><b>01</b> / <?php echo esc_html( str_pad( (string) $n, 2, '0', STR_PAD_LEFT ) ); ?></span>
				<button type="button" class="sha-arrow sha-prev" aria-label="Previous category"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
				<button type="button" class="sha-arrow sha-next" aria-label="Next category"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
			</div>
		</div>
		<div class="sha-stage" tabindex="0" role="list">
			<?php foreach ( $cats as $i => $c ) : ?>
			<a class="sha-card s<?php echo (int) $sizes[ $i % 4 ]; ?> <?php echo ! empty( $c['all'] ) ? 't-all' : 't' . (int) ( ( $i - 1 ) % 5 ); ?>" role="listitem" href="<?php echo esc_url( $c['url'] ); ?>" draggable="false" aria-label="<?php echo esc_attr( $c['name'] ); ?>">
				<span class="sha-blob"><?php echo self::icon( $c['slug'] ); // phpcs:ignore WordPress.Security.EscapeOutput -- static SVG shipped with the plugin. ?></span>
				<span class="sha-meta">
					<span class="sha-en"><?php echo esc_html( $c['name'] ); ?></span>
					<?php if ( $c['ar'] ) : ?><span class="sha-ar"><?php echo esc_html( $c['ar'] ); ?></span><?php endif; ?>
					<span class="sha-foot"><span class="sha-go"><?php echo $arrow; // phpcs:ignore WordPress.Security.EscapeOutput ?></span></span>
				</span>
			</a>
			<?php endforeach; ?>
		</div>
		<div class="sha-chips">
			<?php foreach ( $cats as $c ) : ?>
			<button type="button" class="sha-chip<?php echo ! empty( $c['all'] ) ? ' sha-chip-all' : ''; ?>"><?php echo esc_html( ! empty( $c['all'] ) ? 'All products · كل المنتجات' : $c['name'] ); ?></button>
			<?php endforeach; ?>
		</div>
		<div class="sha-bar"><i></i></div>
	</div>
</section>
		<?php
		return ob_get_clean();
	}

	/**
	 * Best-selling published, visible products that have a photo, in order.
	 */
	private static function products() {
		$cached = get_transient( self::CACHE_KEY );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$query = new WP_Query(
			array(
				'post_type'           => 'product',
				'post_status'         => 'publish',
				'posts_per_page'      => self::MAX_ITEMS,
				'ignore_sticky_posts' => true,
				'no_found_rows'       => true,
				'meta_key'            => 'total_sales',
				'orderby'             => array(
					'meta_value_num' => 'DESC',
					'date'           => 'DESC',
				),
				'meta_query'          => array(
					array(
						'key'     => '_thumbnail_id',
						'compare' => 'EXISTS',
					),
				),
				'tax_query'           => array(
					array(
						'taxonomy' => 'product_visibility',
						'field'    => 'name',
						'terms'    => array( 'exclude-from-catalog' ),
						'operator' => 'NOT IN',
					),
				),
			)
		);

		$items = array();
		foreach ( $query->posts as $post ) {
			$img = get_the_post_thumbnail_url( $post->ID, 'woocommerce_single' );
			if ( ! $img ) {
				continue;
			}
			$items[] = array(
				'name' => wp_strip_all_tags( get_the_title( $post ) ),
				'url'  => get_permalink( $post ),
				'img'  => $img,
			);
		}
		wp_reset_postdata();

		set_transient( self::CACHE_KEY, $items, HOUR_IN_SECONDS );
		return $items;
	}

	public static function render_in_place() {
		if ( self::$printed || ! self::enabled() ) {
			return;
		}
		$html = self::markup( false ) . self::aisles_markup();
		if ( $html ) {
			self::$printed = true;
			echo $html; // phpcs:ignore WordPress.Security.EscapeOutput -- escaped in markup().
		}
	}

	public static function render_fallback() {
		if ( self::$printed || ! self::enabled() ) {
			return;
		}
		$html = self::markup( true ) . self::aisles_markup();
		if ( $html ) {
			self::$printed = true;
			echo $html; // phpcs:ignore WordPress.Security.EscapeOutput -- escaped in markup().
		}
	}

	private static function markup( $move ) {
		$items = self::products();
		if ( count( $items ) < 3 ) {
			return '';
		}
		// The curved row needs at least 10 cards to loop without gaps.
		$base = $items;
		while ( count( $items ) < 10 ) {
			$items = array_merge( $items, $base );
		}

		$join = home_url( '/become-a-customer/' );

		ob_start();
		?>
<section id="shs" class="shs" aria-label="<?php echo esc_attr__( 'Best sellers', 'souriana-hero-shelf' ); ?>"<?php echo $move ? ' data-move="1" style="display:none"' : ''; ?>>
	<div class="shs-frame">
		<div class="shs-copy">
			<div class="shs-badge"><span class="shs-badge-dot"></span>Wholesale food supplier · موردك الموثوق بالجملة</div>
			<h2 class="shs-h1"><span class="shs-l1">Stock Your Shelves</span><span class="shs-l2">with Golden Favorites</span></h2>
			<p class="shs-sub">Wholesale food from the brands your customers love,<br> packed by the carton and delivered fast to your<br> store. Drag the shelf below to explore.</p>
		</div>

		<svg class="shs-doodles" viewBox="0 0 1440 960" aria-hidden="true" focusable="false">
			<path class="shs-draw" pathLength="1" d="M262 332 L284 296"/>
			<path class="shs-draw" pathLength="1" d="M281 338 L303 302"/>
			<path class="shs-draw" pathLength="1" d="M1262 352 C1300 398 1270 436 1160 450"/>
			<path class="shs-draw" pathLength="1" d="M1160 450 L1179 436 M1160 450 L1181 459"/>
			<path class="shs-draw" pathLength="1" d="M462 846 C480 814 546 814 580 842"/>
			<path class="shs-draw" pathLength="1" d="M580 842 L562 840 M580 842 L573 825"/>
		</svg>
		<div class="shs-note shs-note-a">Most<br>ordered<span class="shs-note-ar">الأكثر طلباً</span></div>
		<div class="shs-note shs-note-b">Free to join</div>

		<div class="shs-row" role="list">
			<?php foreach ( $items as $i => $p ) : ?>
			<a class="shs-card" role="listitem" href="<?php echo esc_url( $p['url'] ); ?>" draggable="false" aria-label="<?php echo esc_attr( $p['name'] ); ?>">
				<span class="shs-in">
					<img src="<?php echo esc_url( $p['img'] ); ?>" alt="<?php echo esc_attr( $p['name'] ); ?>" draggable="false" decoding="async" loading="<?php echo $i < 8 ? 'eager' : 'lazy'; ?>">
					<span class="shs-cap"><span class="shs-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg></span><span class="shs-name"><?php echo esc_html( $p['name'] ); ?></span></span>
				</span>
			</a>
			<?php endforeach; ?>
		</div>

		<div class="shs-cta">
			<span class="shs-ring" aria-hidden="true"></span>
			<a class="shs-btn" href="<?php echo esc_url( $join ); ?>">Become a customer · كن عميلاً</a>
		</div>
	</div>
</section>
		<?php
		return ob_get_clean();
	}
}

Souriana_Hero_Shelf::init();

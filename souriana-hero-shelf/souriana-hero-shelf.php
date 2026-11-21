<?php
/**
 * Plugin Name: Souriana Hero Shelf
 * Description: Animated curved product shelf at the top of the homepage only. Shows best-selling products in order; visitors can drag through them. Does not change any other page, product, price or setting. Deactivate to remove it completely.
 * Version: 1.0.3
 * Author: Souriana Golden
 * Requires PHP: 7.4
 * Text Domain: souriana-hero-shelf
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Souriana_Hero_Shelf {

	const VERSION   = '1.0.3';
	const CACHE_KEY = 'souriana_hero_shelf_products_v1';
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
	}

	public static function assets() {
		if ( ! self::enabled() ) {
			return;
		}
		$url = plugin_dir_url( __FILE__ ) . 'assets/';
		wp_enqueue_style(
			'souriana-hero-shelf-fonts',
			'https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Inter+Tight:wght@700&family=Inter:wght@400;500&display=swap',
			array(),
			null
		);
		wp_enqueue_style( 'souriana-hero-shelf', $url . 'shelf.css', array(), self::VERSION );
		wp_enqueue_script( 'souriana-hero-shelf', $url . 'shelf.js', array(), self::VERSION, true );
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
		$html = self::markup( false );
		if ( $html ) {
			self::$printed = true;
			echo $html; // phpcs:ignore WordPress.Security.EscapeOutput -- escaped in markup().
		}
	}

	public static function render_fallback() {
		if ( self::$printed || ! self::enabled() ) {
			return;
		}
		$html = self::markup( true );
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
			<path class="shs-draw" pathLength="1" d="M500 846 C518 814 584 814 618 842"/>
			<path class="shs-draw" pathLength="1" d="M618 842 L600 840 M618 842 L611 825"/>
		</svg>
		<div class="shs-note shs-note-a">Most<br>ordered</div>
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
			<a class="shs-btn" href="<?php echo esc_url( $join ); ?>">Become a customer</a>
		</div>
	</div>
</section>
		<?php
		return ob_get_clean();
	}
}

Souriana_Hero_Shelf::init();

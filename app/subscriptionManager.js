/*** 
 * 
 * Handles interacting w Stripe and Firebase for subscription management.
 * 
 *   initializeFirebase, signIn to get or create a new anonymous fb account, 
 *   getSub to get the users sub from fb account. subscribe() w product key
 *   and manage via the url from getStripePortalURL.
 * 
 ***/

// https://dashboard.stripe.com/apikeys
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51J09w2JfoHixgzDGjawX0gVoce3QDjKIirPWvGcBHhLzaXkimCKkDrlgVefjeOul0SgDUkZvH6M56Liaa46y0WlP00bTJRDdwW';

// live_key =  'pk_live_51J09w2JfoHixgzDGhUqGGQ4LhiZgz3cqBsj2zosjxWchZrxV3J3YkltzzYnWdSWDP1PlHdVLbWXPiEGsGwOukPiX00BzfARovq';

// https://dashboard.stripe.com/tax-rates
const taxRates = [];

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// Config values generated by FB app console
const firebaseConfig = {
  authDomain: "mybraintool-42.firebaseapp.com",
  projectId: "mybraintool-42",
  storageBucket: "mybraintool-42.appspot.com",
  messagingSenderId: "177084785905",
  appId: "1:177084785905:web:305c20b6239b97b3243550"
};

const Annual = "price_1J0uYvJfoHixgzDGqVnNt5Zg";
const Monthly = "price_1J0uYFJfoHixgzDGiXtFAcdB";

const functionLocation = 'us-east1';
let FBDB = null;
function initializeFirebase() {
    // Initialize Firebase
    const firebaseApp = firebase.initializeApp(firebaseConfig);
    FBDB = firebaseApp.firestore();
}

async function signIn() {
    // return current user if signed in, otherwise return a promise that resolves when
    // a new anonymous user is created
    let uid = firebase.auth()?.currentUser?.uid;
    if (uid) return uid;

    return new Promise(function (resolve) {
	firebase.auth().signInAnonymously().then(() => {
	    firebase.auth().onAuthStateChanged((firebaseUser) => {
		if (firebaseUser) resolve(firebaseUser.uid);
	    });
	}).catch((error) => {
	    var errorCode = error.code;
	    var errorMessage = error.message;
	    console.log(errorCode, errorMessage);
	    resolve(null);
	});
    });
}
// NB Signout : firebase.auth().signOut());



async function getSub() {
    // Get subscription record for current user

  FBDB.collection('customers')
    .doc(CurrentUser)
    .collection('subscriptions')
    .where('status', 'in', ['trialing', 'active'])
    .onSnapshot(async (snapshot) => {
	if (snapshot.empty) {
	    console.log("No active subscriptions!");
	    return null;
	}
	
	const subscription = snapshot.docs[0].data();		   // only one
	const priceData = (await subscription.price.get()).data();
	console.log(`Sub Id: ${subscription.items[0].subscription}, ${((priceData.unit_amount / 100).toFixed(2))} per ${priceData.interval}`);
	return subscription.items[0].subscription;
    });
}

// Checkout handler
async function subscribe(productPrice) {
    const selectedPrice = {
	price: productPrice,
	quantity: 1,
    };
    const checkoutSession = {
	collect_shipping_address: false,
	billing_address_collection: 'auto',
	tax_rates: taxRates,
	allow_promotion_codes: true,
	line_items: [selectedPrice],
	success_url: window.location.href,
	cancel_url: window.location.href
    };
    const docRef = await FBDB
	  .collection('customers')
	  .doc(CurrentUser)
	  .collection('checkout_sessions')
	  .add(checkoutSession);
    
    // Wait for the CheckoutSession to get attached by the extension
    docRef.onSnapshot((snap) => {
	const { error, sessionId } = snap.data();
	if (error) {
	    alert(`An error occured: ${error.message}`);
	}
	if (sessionId) {
	    // We have a session, let's redirect to Checkout
	    // Init Stripe
	    const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
	    stripe.redirectToCheckout({ sessionId });
	}
    });
}

async function getStripePortalURL() {
    // Billing portal handler
    const functionRef = firebase
      .app()
      .functions(functionLocation)
      .httpsCallable('ext-firestore-stripe-subscriptions-createPortalLink');
    const { data } = await functionRef({ returnUrl: window.location.origin });
    return data.url;
}
    

// Firebase Configuration for BearOffBattle (Online Tavla)

const firebaseConfig = {
  apiKey:            'AIzaSyDxQ6tBfuB5ofwPHLV6G7qfvh7OwAHYZMI',
  authDomain:        'bearoffbattle.firebaseapp.com',
  databaseURL:       'https://bearoffbattle-default-rtdb.europe-west1.firebasedatabase.app',
  projectId:         'bearoffbattle',
  storageBucket:     'bearoffbattle.firebasestorage.app',
  messagingSenderId: '59908666704',
  appId:             '1:59908666704:web:16255586858aeb92b4a855'
};

// Initialize Firebase (compat SDK — no bundler needed)
firebase.initializeApp(firebaseConfig);
const firebaseDB = firebase.database();

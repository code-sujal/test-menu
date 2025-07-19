// Simple Restaurant Menu - Clean Implementation
import { db } from '../config/firebase-config.js';
import { 
    collection, 
    onSnapshot, 
    addDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Global Variables
let restaurantId = 'restaurant_1';
let tableNumber = null;
let menuItems = {};
let cart = [];
let sessionOrders = [];
let currentCategory = 'all';

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    showLoading();
    detectTable();
    setupEventListeners();
});

// Show Loading
function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

// Table Detection
function detectTable() {
    const urlParams = new URLSearchParams(window.location.search);
    const table = urlParams.get('table');
    
    if (table && parseInt(table) > 0) {
        tableNumber = table;
        document.getElementById('tableNumber').textContent = table;
        hideTableSelector();
        startApp();
    } else {
        showTableSelector();
    }
}

function showTableSelector() {
    hideLoading();
    const grid = document.getElementById('tableGrid');
    let html = '';
    
    for (let i = 1; i <= 20; i++) {
        html += `<button class="table-btn" onclick="selectTable(${i})">Table ${i}</button>`;
    }
    
    grid.innerHTML = html;
    document.getElementById('table-selector').style.display = 'flex';
}

function hideTableSelector() {
    document.getElementById('table-selector').style.display = 'none';
}

// Select Table
window.selectTable = function(table) {
    tableNumber = table;
    document.getElementById('tableNumber').textContent = table;
    
    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('table', table);
    window.history.replaceState({}, '', url);
    
    hideTableSelector();
    startApp();
}

// Start App
function startApp() {
    document.getElementById('menu-app').style.display = 'block';
    loadMenu();
    hideLoading();
}

// Load Menu from Firebase
function loadMenu() {
    const menuRef = collection(db, `restaurants/${restaurantId}/menu_items`);
    
    onSnapshot(menuRef, (snapshot) => {
        menuItems = {};
        
        snapshot.forEach((doc) => {
            const item = { id: doc.id, ...doc.data() };
            
            if (item.available) {
                if (!menuItems[item.category]) {
                    menuItems[item.category] = [];
                }
                menuItems[item.category].push(item);
            }
        });
        
        console.log('Menu loaded:', menuItems);
        displayCategories();
        displayMenuItems();
    }, (error) => {
        console.error('Error loading menu:', error);
        document.getElementById('menuItems').innerHTML = 
            '<div class="empty-state"><h3>Menu temporarily unavailable</h3><p>Please try again later</p></div>';
    });
}

// Display Categories
function displayCategories() {
    const categories = Object.keys(menuItems);
    let html = `<div class="category-scroll">
        <button class="category-btn ${currentCategory === 'all' ? 'active' : ''}" onclick="filterCategory('all')">
            All Items
        </button>`;
    
    categories.forEach(category => {
        const count = menuItems[category].length;
        const isActive = currentCategory === category ? 'active' : '';
        html += `<button class="category-btn ${isActive}" onclick="filterCategory('${category}')">
            ${category.charAt(0).toUpperCase() + category.slice(1)} (${count})
        </button>`;
    });
    
    html += '</div>';
    document.getElementById('categories').innerHTML = html;
}

// Filter by Category
window.filterCategory = function(category) {
    currentCategory = category;
    displayCategories();
    displayMenuItems();
}

// Display Menu Items
function displayMenuItems() {
    const container = document.getElementById('menuItems');
    let html = '';
    
    if (Object.keys(menuItems).length === 0) {
        html = '<div class="empty-state"><h3>No items available</h3><p>Menu is being updated</p></div>';
    } else {
        const categoriesToShow = currentCategory === 'all' ? 
            Object.keys(menuItems) : [currentCategory];
        
        categoriesToShow.forEach(category => {
            if (menuItems[category] && menuItems[category].length > 0) {
                menuItems[category].forEach(item => {
                    html += createMenuItemHTML(item);
                });
            }
        });
        
        if (html === '') {
            html = '<div class="empty-state"><h3>No items in this category</h3></div>';
        }
    }
    
    container.innerHTML = html;
}

// Create Menu Item HTML
function createMenuItemHTML(item) {
    const cartItem = cart.find(c => c.id === item.id);
    const quantity = cartItem ? cartItem.quantity : 0;
    
    const badges = [];
    if (item.isRecommended) badges.push('<span class="badge recommended">Chef\'s Special</span>');
    if (item.isBestseller) badges.push('<span class="badge bestseller">Best Seller</span>');
    if (item.isNew) badges.push('<span class="badge new">New</span>');
    
    return `
        <div class="menu-item">
            <div class="item-image">
                ${item.imageUrl ? 
                    `<img src="${item.imageUrl}" alt="${item.name}">` :
                    '<div class="no-image">🍽️</div>'
                }
                ${badges.length > 0 ? `<div class="item-badges">${badges.join('')}</div>` : ''}
                <div class="prep-time">⏱️ ${getEstimatedTime(item.category)}</div>
            </div>
            
            <div class="item-info">
                <div class="item-header">
                    <div class="item-name">${item.name}</div>
                    <div class="item-price">₹${item.price}</div>
                </div>
                
                <div class="item-description">${item.description}</div>
                
                <div class="item-actions">
                    ${quantity > 0 ? `
                        <div class="quantity-controls">
                            <button class="qty-btn" onclick="updateQuantity('${item.id}', ${quantity - 1})">−</button>
                            <span class="qty-display">${quantity}</span>
                            <button class="qty-btn" onclick="updateQuantity('${item.id}', ${quantity + 1})">+</button>
                        </div>
                    ` : `
                        <button class="add-btn" onclick="addToCart('${item.id}')">
                            Add to Cart
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;
}

// Get Estimated Time
function getEstimatedTime(category) {
    const times = {
        'starters': '8-12 min',
        'mains': '15-25 min',
        'desserts': '5-10 min',
        'beverages': '3-5 min'
    };
    return times[category] || '10-15 min';
}

// Add to Cart
window.addToCart = function(itemId) {
    const item = findItemById(itemId);
    if (!item) return;
    
    const existingItem = cart.find(c => c.id === itemId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: item.id,
            name: item.name,
            price: item.price,
            imageUrl: item.imageUrl,
            quantity: 1
        });
    }
    
    updateCartDisplay();
    displayMenuItems();
    saveCart();
}

// Update Quantity
window.updateQuantity = function(itemId, newQuantity) {
    if (newQuantity <= 0) {
        cart = cart.filter(c => c.id !== itemId);
    } else {
        const cartItem = cart.find(c => c.id === itemId);
        if (cartItem) {
            cartItem.quantity = newQuantity;
        }
    }
    
    updateCartDisplay();
    displayMenuItems();
    saveCart();
}

// Update Cart Display
function updateCartDisplay() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    document.getElementById('cartCount').textContent = totalItems;
    document.getElementById('cartTotal').textContent = totalAmount;
    
    const cartFloat = document.getElementById('cartFloat');
    cartFloat.style.display = totalItems > 0 ? 'block' : 'none';
    
    updateSessionDisplay();
}

// Update Session Display
function updateSessionDisplay() {
    const sessionTotal = sessionOrders.reduce((sum, order) => sum + order.total, 0);
    const sessionItems = sessionOrders.reduce((sum, order) => 
        sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
    );
    
    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    document.getElementById('sessionItems').textContent = `${sessionItems + cartItems} items ordered`;
    document.getElementById('sessionTotal').textContent = `₹${sessionTotal + cartTotal} total`;
}

// Find Item by ID
function findItemById(id) {
    for (const category in menuItems) {
        const item = menuItems[category].find(item => item.id === id);
        if (item) return item;
    }
    return null;
}

// Save Cart to LocalStorage
function saveCart() {
    localStorage.setItem(`cart_${restaurantId}_${tableNumber}`, JSON.stringify(cart));
}

// Load Cart from LocalStorage
function loadCart() {
    const savedCart = localStorage.getItem(`cart_${restaurantId}_${tableNumber}`);
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartDisplay();
        displayMenuItems();
    }
}

// Open Cart Modal
window.openCart = function() {
    displayCartItems();
    document.getElementById('cartModal').classList.add('show');
}

// Close Cart Modal
window.closeCart = function() {
    document.getElementById('cartModal').classList.remove('show');
}

// Display Cart Items
function displayCartItems() {
    const container = document.getElementById('cartItems');
    
    if (cart.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>Your cart is empty</h3></div>';
    } else {
        let html = '';
        cart.forEach(item => {
            html += `
                <div class="cart-item">
                    <div class="cart-item-image">
                        ${item.imageUrl ? 
                            `<img src="${item.imageUrl}" alt="${item.name}">` :
                            '🍽️'
                        }
                    </div>
                    <div class="cart-item-details">
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-price">₹${item.price} × ${item.quantity} = ₹${item.price * item.quantity}</div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('modalTotal').textContent = total;
}

// Place Order
window.placeOrder = async function() {
    if (cart.length === 0) return;
    
    try {
        const order = {
            tableNumber: parseInt(tableNumber),
            items: [...cart],
            total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            status: 'pending',
            timestamp: new Date(),
            restaurantId: restaurantId
        };
        
        const ordersRef = collection(db, `restaurants/${restaurantId}/orders`);
        await addDoc(ordersRef, order);
        
        sessionOrders.push(order);
        cart = [];
        updateCartDisplay();
        displayMenuItems();
        saveCart();
        
        closeCart();
        showSuccessModal();
        
    } catch (error) {
        console.error('Error placing order:', error);
        alert('Failed to place order. Please try again.');
    }
}

// Show Success Modal
function showSuccessModal() {
    document.getElementById('successModal').classList.add('show');
}

// Close Success Modal
window.closeSuccess = function() {
    document.getElementById('successModal').classList.remove('show');
}

// Request Service
window.requestService = async function(type) {
    const messages = {
        water: 'Water requested',
        waiter: 'Waiter assistance requested',
        bill: 'Bill requested'
    };
    
    try {
        const serviceRef = collection(db, `restaurants/${restaurantId}/service_requests`);
        await addDoc(serviceRef, {
            tableNumber: parseInt(tableNumber),
            type: type,
            message: `${messages[type]} for table ${tableNumber}`,
            timestamp: new Date(),
            status: 'pending'
        });
        
        // Show confirmation
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = '✓ Requested';
        button.style.background = '#38a169';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 2000);
        
    } catch (error) {
        console.error('Error requesting service:', error);
    }
}

// End Session
window.endSession = function() {
    if (cart.length > 0) {
        alert('Please place your current order before ending the session.');
        return;
    }
    
    if (sessionOrders.length === 0) {
        alert('No orders placed in this session.');
        return;
    }
    
    if (confirm('Are you ready to end your session and receive the bill?')) {
        generateBill();
    }
}

// Generate Bill
function generateBill() {
    const subtotal = sessionOrders.reduce((sum, order) => sum + order.total, 0);
    const tax = Math.round(subtotal * 0.18);
    const total = subtotal + tax;
    
    const billHTML = `
        <div style="max-width: 400px; margin: 20px auto; background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0;">
                <h1 style="color: #2d3748; margin-bottom: 10px;">🍽️ Restaurant Bill</h1>
                <p>Table ${tableNumber} • ${new Date().toLocaleDateString()}</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h3 style="margin-bottom: 15px;">Order Summary:</h3>
                ${sessionOrders.map((order, index) => `
                    <div style="margin-bottom: 15px; padding: 10px; background: #f8fafc; border-radius: 6px;">
                        <strong>Order #${index + 1}</strong>
                        ${order.items.map(item => `
                            <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                                <span>${item.name} × ${item.quantity}</span>
                                <span>₹${item.price * item.quantity}</span>
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
            
            <div style="border-top: 2px solid #e2e8f0; padding-top: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span>Subtotal:</span>
                    <span>₹${subtotal}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span>Tax (18%):</span>
                    <span>₹${tax}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                    <span>Total:</span>
                    <span>₹${total}</span>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #4a5568; font-style: italic;">
                "Thank you for dining with us! We hope you had a wonderful experience."
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
                <button onclick="location.reload()" style="background: #3182ce; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; cursor: pointer;">
                    Start New Session
                </button>
            </div>
        </div>
    `;
    
    document.body.innerHTML = billHTML;
}

// Event Listeners
function setupEventListeners() {
    // Search
    document.getElementById('searchInput').addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        
        if (searchTerm.length < 2) {
            displayMenuItems();
            return;
        }
        
        const container = document.getElementById('menuItems');
        let html = '';
        
        for (const category in menuItems) {
            menuItems[category].forEach(item => {
                if (item.name.toLowerCase().includes(searchTerm) ||
                    item.description.toLowerCase().includes(searchTerm)) {
                    html += createMenuItemHTML(item);
                }
            });
        }
        
        if (html === '') {
            html = '<div class="empty-state"><h3>No items found</h3><p>Try a different search term</p></div>';
        }
        
        container.innerHTML = html;
    });
    
    // Load saved cart on start
    setTimeout(() => {
        if (tableNumber) {
            loadCart();
        }
    }, 1000);
}

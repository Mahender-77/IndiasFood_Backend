"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const SubCategorySchema = new mongoose_1.default.Schema({
    name: {
        type: String,
        required: [true, 'Subcategory name is required'],
        trim: true,
        maxlength: [100, 'Subcategory name cannot exceed 100 characters']
    },
    isActive: {
        type: Boolean,
        default: true
    },
}, { _id: true });
const CategorySchema = new mongoose_1.default.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
        unique: true,
        trim: true,
        maxlength: [100, 'Category name cannot exceed 100 characters']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    subcategories: [SubCategorySchema],
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});
// Index for performance (name index is automatically created by unique constraint)
CategorySchema.index({ isActive: 1 });
// Virtual to count active subcategories
CategorySchema.virtual('activeSubcategoryCount').get(function () {
    if (!this.subcategories)
        return 0;
    return this.subcategories.filter(sub => sub.isActive).length;
});
// Instance method to get active subcategories
CategorySchema.methods.getActiveSubcategories = function () {
    return this.subcategories?.filter((sub) => sub.isActive) || [];
};
// Instance method to add subcategory
CategorySchema.methods.addSubcategory = function (name) {
    if (!this.subcategories) {
        this.subcategories = [];
    }
    this.subcategories.push({ name, isActive: true });
    return this.save();
};
// Instance method to remove subcategory
CategorySchema.methods.removeSubcategory = function (subcategoryId) {
    if (!this.subcategories)
        return this;
    this.subcategories = this.subcategories.filter((sub) => sub._id?.toString() !== subcategoryId);
    return this.save();
};
// Static method to find categories with active subcategories
CategorySchema.statics.findWithActiveSubcategories = function () {
    return this.find({ isActive: true })
        .where('subcategories.0')
        .exists(true);
};
const Category = mongoose_1.default.model('Category', CategorySchema);
exports.default = Category;

import mongoose, { Document } from 'mongoose';

export interface ISubCategory {
  _id?: string;
  name: string;
  isActive: boolean;
}

export interface ICategory {
  name: string;
  isActive: boolean;
  subcategories?: ISubCategory[];
}

const SubCategorySchema = new mongoose.Schema<ISubCategory>({
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

const CategorySchema = new mongoose.Schema<ICategory & Document>({
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
CategorySchema.virtual('activeSubcategoryCount').get(function(this: ICategory & Document) {
  if (!this.subcategories) return 0;
  return this.subcategories.filter(sub => sub.isActive).length;
});

// Instance method to get active subcategories
CategorySchema.methods.getActiveSubcategories = function() {
  return this.subcategories?.filter((sub: ISubCategory) => sub.isActive) || [];
};

// Instance method to add subcategory
CategorySchema.methods.addSubcategory = function(name: string) {
  if (!this.subcategories) {
    this.subcategories = [];
  }
  this.subcategories.push({ name, isActive: true });
  return this.save();
};

// Instance method to remove subcategory
CategorySchema.methods.removeSubcategory = function(subcategoryId: string) {
  if (!this.subcategories) return this;
  this.subcategories = this.subcategories.filter(
    (sub: ISubCategory) => sub._id?.toString() !== subcategoryId
  );
  return this.save();
};

// Static method to find categories with active subcategories
CategorySchema.statics.findWithActiveSubcategories = function() {
  return this.find({ isActive: true })
    .where('subcategories.0')
    .exists(true);
};

const Category = mongoose.model<ICategory & Document>('Category', CategorySchema);
export default Category;
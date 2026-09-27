// Converts between the admin product form (string values) and the API's product fields.

export const EMPTY_PRODUCT_VALUES = {
  name: '',
  brand: '',
  category: '',
  description: '',
  price: '',
  mrp: '',
  stock: '',
  imageUrl: '',
  isFeatured: false,
};

// Form values are strings; this turns them into the API's product fields
export const toProductPayload = (values) => ({
  name: values.name.trim(),
  brand: values.brand.trim(),
  category: values.category,
  description: values.description.trim(),
  price: Number(values.price),
  mrp: values.mrp.trim() === '' ? null : Number(values.mrp),
  stock: Number(values.stock),
  isFeatured: values.isFeatured,
});

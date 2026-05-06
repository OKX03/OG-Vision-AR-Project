export interface ProductImage {
  image_url: string;
  view_type: string;
}

export interface Product{

    product_id?: string

    brand?: string
    model?: string
    price?: number
    gender?: string

    color?: string
    colorName?: string
    frameShape?: string
    frameMaterial?: string
    faceShape?: string[]

    frameSize?: string
    lensWidth?: number
    lensHeight?: number
    bridgeWidth?: number
    templeLength?: number

    description?: string
    frontImage?: string;
    sideImage?: string;
    arModel?: string | null;
    quantity?: number;
}